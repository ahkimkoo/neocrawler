/**
 * Created by james on 13-11-22.
 * pipeline middleware
 */
var crypto = require('crypto');
var redis = require("redis");
var HBase = require('../lib/node_hbase/index.js');
var hbase_http = require('hbase');
var os = require("os");
var async = require('async');
var urlUtil =  require("url");
var querystring = require('querystring');
var util = require('util');
require('../lib/jsextend.js');

var pipeline = function(spiderCore){
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;
}

////report to spidercore standby////////////////////////
pipeline.prototype.assembly = function(callback){
    var spiderCore = this.spiderCore;
    this.hbase_via_http = false;
    if(spiderCore.settings['crawled_hbase_conf'] instanceof Array)this.hbase_via_http  = true;
    if(this.spiderCore.settings['save_content_to_hbase']===true){
        if(this.hbase_via_http){
            this.hbase_cli = hbase_http({
                host:this.spiderCore.settings['crawled_hbase_conf'][0],
                port:this.spiderCore.settings['crawled_hbase_conf'][1]
            });
            this.HBASE_TABLE = this.hbase_cli.getTable(this.spiderCore.settings['crawled_hbase_table']);
            this.HBASE_BIN_TABLE = this.hbase_cli.getTable(this.spiderCore.settings['crawled_hbase_bin_table']);
        }else{
            this.hbase_cli = HBase(this.spiderCore.settings['crawled_hbase_conf']);
            this.HBASE_TABLE = this.spiderCore.settings['crawled_hbase_table'];
            this.HBASE_BIN_TABLE = this.spiderCore.settings['crawled_hbase_bin_table'];
        }
    }

    this.redis_cli0 = spiderCore.spider.redis_cli0;
    this.redis_cli1 = spiderCore.spider.redis_cli1;
    this.redis_cli2 = spiderCore.spider.redis_cli2;
    if(callback)callback(null,'done');
}
/**
 * save links to redis db
 * @param page_url
 * @param linkobjs
 */
pipeline.prototype.save_links = function(page_url,version,linkobjs,drill_relation,callback){
    var spiderCore = this.spiderCore;
    var redis_cli0 = this.redis_cli0;
    var redis_cli1 = this.redis_cli1;
    var aliasArr = Object.keys(linkobjs);
    var linkCount = 0;
    var index = 0;
    if(!version)version = (new Date()).getTime();
    async.whilst(
        function () { return index < aliasArr.length; },
        function (cb) {
            var alias = aliasArr[index];
            var links = linkobjs[alias];
            var t_alias_arr = alias.split(':');
            var drill_alias = t_alias_arr[3];
            var domain = t_alias_arr[2];
            if(!spiderCore.spider.driller_rules[domain]||!spiderCore.spider.driller_rules[domain][drill_alias]){
                logger.error(alias+' not in configuration');
                cb(new Error('Drill rule not found'));
            }
            var t_driller_rules = spiderCore.spider.driller_rules[domain][drill_alias];
            if(typeof(t_driller_rules)!='object')t_driller_rules = JSON.parse(t_driller_rules);
            ////////////////////////////////link array/////////////////////////
            var sindex = 0;
            async.whilst(
                function () { return sindex < links.length; },
                function (scb) {
                    var link = links[sindex];
                    linkCount++;
                    /////save a link/////////////////////
                    async.waterfall([
                        //transform link////////////////////////////////
                        function(mcb){
                            var final_link = link;
                            var urlobj = urlUtil.parse(link);
                            if(t_driller_rules['id_parameter']){
                                var id_parameter = t_driller_rules['id_parameter'];
                                if(typeof(id_parameter)!='object')id_parameter = JSON.parse(id_parameter);
                                if(Array.isArray(id_parameter)&&id_parameter.length>0){
                                    var parameters = querystring.parse(urlobj.query);
                                    var new_parameters = {};
                                    for(var x=0;x<id_parameter.length;x++){
                                        var param_name = id_parameter[x];
                                        if(x==0&&param_name=='#')break;
                                        if(parameters.hasOwnProperty(param_name))new_parameters[param_name] = parameters[param_name];
                                    }
                                    urlobj.search = querystring.stringify(new_parameters);
                                    final_link = urlUtil.format(urlobj);
                                }
                            }
                            return mcb(null,final_link);
                        },
                        ////get url info //////////////
                        function(final_link, mcb){
                            if(final_link!=link)logger.debug('Transform: ' + link + ' -> '+final_link);
                            var urlhash = crypto.createHash('md5').update(final_link+'').digest('hex');
                            redis_cli1.hgetall(urlhash,function(err, value){
                                mcb(err,final_link,urlhash,value);
                            });
                        },
                        //check url////////////////////////
                        function(final_link,urlhash,values,mcb){
                            var validate = true;
                            if(values&&!isEmpty(values)){
                                var status = values['status'];
                                var records = values['records']?JSON.parse(values['records']):[];
                                var last = parseInt(values['last']);
                                var t_version = parseInt(values['version']);
                                var type = values['type'];

                                if(status!='crawled_failure'){
                                    var real_interval = t_driller_rules['schedule_interval']*1000;
                                    if(status=='crawling'||status=='schedule'){
                                        real_interval = 10*60*1000;//url request hang up or interrupted, give opportunity to crawl after 10 minutes.
                                    }
                                    if(status=='hit'){
                                        real_interval = 2*24*60*60*1000;//probably schedule lost, give opportunity to crawl after 2 days.
                                    }
                                    if(status=='crawled_finish'&&type=='branch'&&version>last){
                                        real_interval = 0;
                                        logger.debug(final_link +' got new version after last crawling');
                                    }
                                    if((new Date()).getTime()-last<real_interval){
                                        logger.debug(util.format('ignore %s, last event time:%s, status:%s',final_link,last,status));
                                        validate = false;
                                    }else{
                                        logger.debug(final_link+' should insert into urlqueue');
                                    }
                                }
                                //version update////////////////////////////////////////////////////////////////
                                logger.debug('url info exists, '+link+', just update the version');
                                var ctc = {};
                                if(validate)ctc['status'] = 'hit';
                                if(version>t_version||isNaN(t_version)){
                                    ctc['version'] = version;
                                    logger.debug('update url('+final_link+') version, '+t_version+' -> '+version);
                                }else {
                                    logger.debug(final_link+' keep the version: '+values['version']);
                                }
                                if(!isEmpty(ctc)){
                                    redis_cli1.hmset(urlhash,ctc,function(err, svalue){
                                        if(err){logger.error(err);}
                                        logger.debug('update url('+final_link+') version, '+t_version+' -> '+version);
                                        mcb(err,final_link,validate);
                                    });
                                }else mcb(null,final_link,validate);
                                //////////////////////////////////////////////////////////////////////////////
                            }else{
                                var vv = {
                                    'url':link,
                                    'version':version,
                                    'trace':alias,
                                    'referer':page_url,
                                    'create':(new Date()).getTime(),
                                    'records':JSON.stringify([]),
                                    'last':(new Date()).getTime(),
                                    'status':'hit'
                                }
                                if(spiderCore.settings['keep_link_relation']){
                                    vv['drill_relation'] = drill_relation?drill_relation:'*';
                                }
                                redis_cli1.hmset(urlhash,vv,function(err, value){
                                    if (err) throw(err);
                                    logger.debug(' save new url('+link+') to urlinfo.');
                                    mcb(null,final_link,true);
                                });
                            }
                        },
                        ////save link to urllib////////////
                        function(final_link,validate,mcb){
                            if(validate){
                                redis_cli0.rpush(alias,final_link,function(err, value){
                                    if(err)throw(err);
                                    logger.debug('push url: '+link+' to urllib: '+alias);
                                    mcb(err,value);
                                });
                            }else mcb(null,'done');
                        }
                    ], function (err, result) {
                        sindex++;
                        scb(err);
                    });
                    ////////////////////////////////////
                },
                function (err) {
                    index++;
                    cb(err);
                }
            );
            ///////////////////////////////////////////////////////////////////
        },
        function (err) {
            logger.info('save '+linkCount+' links from '+page_url+' to redis');
            if(callback)callback(null,true);
        }
    );
}
/**
 * save content to hbase(default), if pipeline defined in spider_extend, it will be covered.
 * @param pageurl
 * @param content
 * @param referer
 * @param urllib
 */
pipeline.prototype.save_content = function(pageurl,content,extracted_data,js_result,referer,urllib,drill_relation,callback){
    if(this.hbase_via_http)return this.save_content_vhttp(pageurl,content,extracted_data,js_result,referer,urllib,drill_relation,callback);

    var url_hash = crypto.createHash('md5').update(pageurl+'').digest('hex');
    var spider = os.hostname()+'-'+process.pid;
    var start_time = (new Date()).getTime();
    var self = this;

    var dict = {
        'row' : url_hash,
        'basic:spider' : spider,
        'basic:url' : pageurl,
        'basic:referer' : referer,
        'basic:urllib' : urllib,
        'basic:drill_relation': drill_relation,
        'basic:updated' : (new Date()).getTime().toString()
    }

    if(content&&!isEmpty(content)){
        dict['basic:content'] = content;
    }

    if(extracted_data&&!isEmpty(extracted_data)){
        for(d in extracted_data){
            if(extracted_data.hasOwnProperty(d)&&extracted_data[d]!=undefined){
                dict['data:'+d] = typeof(extracted_data[d])=='object'?JSON.stringify(extracted_data[d]):extracted_data[d];
            }
        }
    }

    if(js_result&&!isEmpty(js_result)){
        dict['basic:jsresult'] = js_result;
    }

    this.hbase_cli.mput(extracted_data['$category']||this.HBASE_TABLE,[dict], function (err,res) {
        if(err){
            logger.error(pageurl+', data insert to hbase error: '+err);
            self.redis_cli2.zadd('stuck:'+urllib,(new Date()).getTime(),pageurl,function(err,result){
                if(err)throw err;
                logger.debug('append '+pageurl+' to stuck record');
                if(callback)callback(err);
            });
        }else{
            logger.info(pageurl+', data insert to hbase cost '+((new Date()).getTime()-start_time)+' ms');
            self.redis_cli2.zrem('stuck:'+urllib,pageurl,function(err,result){
                if(err)throw err;
                logger.debug('remove '+pageurl+' from stuck record');
                if(callback)callback(err);
            });
        }
    });
}
/**
 * save content via http
 * @param pageurl
 * @param content
 * @param extracted_data
 * @param js_result
 * @param referer
 * @param urllib
 * @param drill_relation
 * @param callback
 */
pipeline.prototype.save_content_vhttp = function(pageurl,content,extracted_data,js_result,referer,urllib,drill_relation,callback){
    var url_hash = crypto.createHash('md5').update(pageurl+'').digest('hex');
    var spider = os.hostname()+'-'+process.pid;
    var start_time = (new Date()).getTime();
    var self = this;

//    var val_cells = [
//                { "column":"basic:spider","timestamp":Date.now(),"$":spider},
//                { "column":"basic:url","timestamp":Date.now(),"$":pageurl},
//                { "column":"basic:content","timestamp":Date.now(),"$":content}
//                ];
    var keylist = ['basic:spider','basic:url','basic:updated'];
    var valuelist = [spider,pageurl,(new Date()).getTime().toString()];

    if(referer&&!isEmpty(referer)){
        keylist.push('basic:referer');
        valuelist.push(referer);
    }

    if(urllib&&!isEmpty(urllib)){
        keylist.push('basic:urllib');
        valuelist.push(urllib);
    }

    if(drill_relation&&!isEmpty(drill_relation)){
        keylist.push('basic:drill_relation');
        valuelist.push(drill_relation);
    }

    if(content&&!isEmpty(content)){
        keylist.push('basic:content');
        valuelist.push(content);
    }

    if(extracted_data&&!isEmpty(extracted_data)){
        for(d in extracted_data){
            if(extracted_data.hasOwnProperty(d)&&extracted_data[d]!=undefined){
                keylist.push('data:'+d);
                valuelist.push(typeof(extracted_data[d])=='object'?JSON.stringify(extracted_data[d]):extracted_data[d]);
            }
        }
//            keylist.push('basic:data');
//            valuelist.push(JSON.stringify(extracted_data));
    }
    if(js_result&&!isEmpty(js_result)){
        keylist.push('basic:jsresult');
        valuelist.push(js_result);
    }
    var row = this.HBASE_TABLE.getRow(url_hash);
    try{
        row.put(keylist,valuelist,function(err,success){
            logger.info('insert content extracted from '+pageurl+', cost: '+((new Date()).getTime() - start_time)+' ms');
            if(err){
                logger.error(pageurl+', data insert to hbase error: '+err);
                self.redis_cli2.zadd('stuck:'+urllib,(new Date()).getTime(),pageurl,function(err,result){
                    if(err)throw err;
                    logger.debug('append '+pageurl+' to stuck record');
                    if(callback)callback(err);
                });
            }else{
                logger.info(pageurl+', data insert to hbase cost '+((new Date()).getTime()-start_time)+' ms');
                self.redis_cli2.zrem('stuck:'+urllib,pageurl,function(err,result){
                    if(err)throw err;
                    logger.debug('remove '+pageurl+' from stuck record');
                    if(callback)callback(err);
                });
            }
        });
//        row.put(['basic:spider','basic:url','basic:content'],[spider,pageurl,content],function(err,success){
//            logger.debug('insert content extracted from '+pageurl);
//        });
    }catch(e){
        logger.error(pageurl+', data insert to hbase error: '+e);
        self.redis_cli2.zadd('stuck:'+urllib,(new Date()).getTime(),pageurl,function(err,result){
            if(err)throw err;
            logger.debug('append '+pageurl+' to stuck record');
            if(callback)callback(err);
        });
    }
}

pipeline.prototype.save_binary = function(pageurl,content,referer,urllib,drill_relation,callback){
    if(this.hbase_via_http)return this.save_binary_vhttp(pageurl,content,referer,urllib,drill_relation,callback);

    var url_hash = crypto.createHash('md5').update(pageurl+'').digest('hex');
    var spider = os.hostname()+'-'+process.pid;
    var start_time = (new Date()).getTime();
    var self = this;

    var dict = {
        'row' : url_hash,
        'basic:spider' : spider,
        'basic:url' : pageurl,
        'binary:file': content,
        'basic:referer' : referer,
        'basic:urllib' : urllib,
        //'basic:drill_relation': drill_relation,
        'basic:updated' : (new Date()).getTime().toString()
    }

    this.hbase_cli.mput(this.HBASE_BIN_TABLE, [dict], function (err,res) {
        if(err){
            logger.error(pageurl+', data insert to hbase error: '+err);
            self.redis_cli2.zadd('stuck:'+urllib,(new Date()).getTime(),pageurl,function(err,result){
                if(err)throw err;
                logger.debug('append '+pageurl+' to stuck record');
                if(callback)callback(err);
            });
        }else{
            logger.info(pageurl+', data insert to hbase cost '+((new Date()).getTime()-start_time)+' ms');
            self.redis_cli2.zrem('stuck:'+urllib,pageurl,function(err,result){
                if(err)throw err;
                logger.debug('remove '+pageurl+' from stuck record');
                if(callback)callback(err);
            });
        }
    });
}

/**
 * save binary to hbase via http
 * @param pageurl
 * @param content
 * @param referer
 * @param urllib
 * @param drill_relation
 * @param callback
 */
pipeline.prototype.save_binary_vhttp = function(pageurl,content,referer,urllib,drill_relation,callback){
    var url_hash = crypto.createHash('md5').update(pageurl+'').digest('hex');
    var spider = os.hostname()+'-'+process.pid;
    var start_time = (new Date()).getTime();
    var self = this;

    var keylist = [
        'basic:spider',
        'basic:url',
        'basic:updated'
    ];
    var valuelist = [
        spider,
        pageurl,
        (new Date()).getTime().toString()
    ];

    if(referer){
        keylist.push('basic:referer');
        valuelist.push(referer);
    }

    if(urllib){
        keylist.push('basic:urllib');
        valuelist.push(urllib);
    }

    if(drill_relation){
        keylist.push('basic:drill_relation');
        valuelist.push(drill_relation);
    }

    if(content){
        keylist.push('binary:file');
        valuelist.push(content);
    }

    var row = this.HBASE_BIN_TABLE.getRow(url_hash);
    try{
        row.put(keylist,valuelist,function(err,success){
            logger.info('insert content extracted from '+pageurl+', cost: '+((new Date()).getTime() - start_time)+' ms');
            if(err){
                logger.error(pageurl+', data insert to hbase error: '+err);
                self.redis_cli2.zadd('stuck:'+urllib,(new Date()).getTime(),pageurl,function(err,result){
                    if(err)throw err;
                    logger.debug('append '+pageurl+' to stuck record');
                    if(callback)callback(err);
                });
            }else{
                logger.info(pageurl+', data insert to hbase cost '+((new Date()).getTime()-start_time)+' ms');
                self.redis_cli2.zrem('stuck:'+urllib,pageurl,function(err,result){
                    if(err)throw err;
                    logger.debug('remove '+pageurl+' from stuck record');
                    if(callback)callback(err);
                });
            }
        });
    }catch(e){
        logger.error(pageurl+', data insert to hbase error(2): '+e);
        self.redis_cli2.zadd('stuck:'+urllib,(new Date()).getTime(),pageurl,function(err,result){
            if(err)throw err;
            logger.debug('append '+pageurl+' to stuck record');
            if(callback)callback(err);
        });
    }
}

/**
 * pipeline save entrance
 * @param extracted_info
 */
pipeline.prototype.save =function(extracted_info,callback){
    var pipeline = this;
    if(this.spiderCore.settings['test']){
        var fs = require('fs');
        var path = require('path');
        if(extracted_info['origin']['format']=='binary'){
            var dumpfile = path.join(__dirname,'..', 'instance',this.spiderCore.settings['instance'],'logs','dumpfile.jpg');
            fs.writeFile(dumpfile,extracted_info['content'],'utf8',function(err){
                if (err)throw err;
                logger.debug('Crawling file saved, '+dumpfile);
                if(callback)callback(true);
            });
        }else{
            var htmlfile = path.join(__dirname,'..', 'instance',this.spiderCore.settings['instance'],'logs','debug-page.html');
            var resultfile = path.join(__dirname,'..', 'instance',this.spiderCore.settings['instance'],'logs','debug-result.json');
            fs.writeFile(htmlfile,extracted_info['content'],'utf8', function (err) {
                if (err)throw err;
                logger.debug('Content saved, '+htmlfile);
                delete extracted_info['content'];
                fs.writeFile(resultfile,JSON.stringify(extracted_info),'utf8',function(err){
                    if (err)throw err;
                    logger.debug('Crawling result saved, '+resultfile);
                    if(callback)callback(true);
                    else process.exit(0);
                });
            });
        }
    }else{
        async.series([
                function(cb){
                    if(extracted_info['drill_link'])pipeline.save_links(extracted_info['url'],extracted_info['origin']['version'],extracted_info['drill_link'],extracted_info['drill_relation'],cb);
                    else cb(null);
                },
                function(cb){
                    if(pipeline.spiderCore.settings['save_content_to_hbase']===true&&extracted_info['origin']['type']=='node'){//type must be node
                        if('save_content_alert' in pipeline.spiderCore.spider_extend)pipeline.spiderCore.spider_extend.save_content_alert(extracted_info);//report
                        if(extracted_info['origin']['format']=='binary'){
                            pipeline.save_binary(extracted_info['url'],extracted_info['content'],extracted_info['origin']['referer'],extracted_info['origin']['urllib'],extracted_info['drill_relation'],cb);
                        }else{
                            var html_content = extracted_info['content'];
                            if(!extracted_info['origin']['save_page'])html_content = false;
                            pipeline.save_content(extracted_info['url'],html_content,extracted_info['extracted_data'],extracted_info['js_result'],extracted_info['origin']['referer'],extracted_info['origin']['urllib'],extracted_info['drill_relation'],cb);
                        }
                    }else cb(null);
                },
                function(cb){
                    if('pipeline' in pipeline.spiderCore.spider_extend)pipeline.spiderCore.spider_extend.pipeline(extracted_info,cb);//spider extend
                    else cb(null);
                }
             ],
            function(err, results){
                logger.info(extracted_info['url']+', pipeline completed');
                callback(err);
            });
    }
}

module.exports = pipeline;
