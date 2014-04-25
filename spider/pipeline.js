/**
 * Created by james on 13-11-22.
 * pipeline middleware
 */
var crypto = require('crypto');
var redis = require("redis");
var HBase = require('hbase-client');
var os = require("os");
var async = require('async');
require('../lib/jsextend.js');

var pipeline = function(spiderCore){
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;
}

////report to spidercore standby////////////////////////
pipeline.prototype.assembly = function(){
    if(this.spiderCore.settings['save_content_to_hbase']===true){
        this.hbase_cli = HBase.create(this.spiderCore.settings['crawled_hbase_conf']);
        this.HBASE_TABLE = this.spiderCore.settings['crawled_hbase_table'];
        this.HBASE_BIN_TABLE = this.spiderCore.settings['crawled_hbase_bin_table'];
    }

    this.redis_cli0 = redis.createClient(this.spiderCore.settings['driller_info_redis_db'][1],this.spiderCore.settings['driller_info_redis_db'][0]);
    this.redis_cli1 = redis.createClient(this.spiderCore.settings['url_info_redis_db'][1],this.spiderCore.settings['url_info_redis_db'][0]);
    var spider = this;
    var spiderCore = this.spiderCore;
    this.redis_cli0.select(this.spiderCore.settings['driller_info_redis_db'][2], function(err,value) {
        spider.redis_cli1.select(spiderCore.settings['url_info_redis_db'][2], function(err,value) {
            spiderCore.emit('standby','pipeline');
        });
    });
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
    async.whilst(
        function () { return index < aliasArr.length; },
        function (cb) {
            var alias = aliasArr[index];
            var links = linkobjs[alias];
            ////////////////////////////////link array/////////////////////////
            var sindex = 0;
            async.whilst(
                function () { return sindex < links.length; },
                function (scb) {
                    var link = links[sindex];
                    linkCount++;
                    /////save a link/////////////////////
                    async.waterfall([
                        ////save link to urllib////////////
                        function(mcb){
                            redis_cli0.rpush(alias,link,function(err, value){
                                    if(err)throw(err);
                                    logger.debug('push url: '+link+' to urllib: '+alias);
                                    mcb(err,value);
                            });
                        },
                        ////get url info //////////////
                        function(value, mcb){
                            var urlhash = crypto.createHash('md5').update(link+'').digest('hex');
                            redis_cli1.hgetall(urlhash,function(err, value){
                                mcb(err,urlhash,value);
                            });
                        },
                        ////update urlinfo///////////////////////////////////////////////////////////////////////////
                        function(urlhash,value, mcb){
                            if(value){
                                logger.debug('url info exists, '+link+', just update the version');
                                if(version>parseInt(value['version'])||isNaN(parseInt(value['version']))){
                                    redis_cli1.hset(urlhash,'version',version,function(err, svalue){
                                        if(err){loggeer.error(err);}
                                        logger.debug('update url('+link+') version, '+value['version']+' -> '+version);
                                        mcb(err, 'done');
                                    });
                                }else {
                                    logger.debug(link+' keep the version: '+value['version']);
                                    mcb(null, 'done');
                                }
                            }else{
                                var vv = {
                                    'url':link,
                                    'version':version,
                                    'trace':alias,
                                    'referer':page_url,
                                    'drill_relation':drill_relation?drill_relation:'*',
                                    'create':(new Date()).getTime(),
                                    'records':JSON.stringify([]),
                                    'last':(new Date()).getTime(),
                                    'status':'hit'
                                }
                                redis_cli1.hmset(urlhash,vv,function(err, value){
                                    if (err) throw(err);
                                    logger.debug(' save url('+link+') to urlinfo.');
                                    mcb(err, 'done');
                                });
                            }
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
    var url_hash = crypto.createHash('md5').update(pageurl+'').digest('hex');
    var spider = os.hostname()+'-'+process.pid;
    var start_time = (new Date()).getTime();

    var dict = {
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

    this.hbase_cli.putRow(this.HBASE_TABLE, url_hash, dict, function (err) {
        if(err)logger.error(pageurl+', data insert to hbase error: '+err);
        else logger.info(pageurl+', data insert to hbase cost '+((new Date()).getTime()-start_time)+' ms');
        if(callback)callback(null);
    });
}

pipeline.prototype.save_binary = function(pageurl,content,referer,urllib,drill_relation,callback){
    var url_hash = crypto.createHash('md5').update(pageurl+'').digest('hex');
    var spider = os.hostname()+'-'+process.pid;
    var start_time = (new Date()).getTime();

    var dict = {
        'basic:spider' : spider,
        'basic:url' : pageurl,
        'binary:file': content,
        'basic:referer' : referer,
        'basic:urllib' : urllib,
        'basic:drill_relation': drill_relation,
        'basic:updated' : (new Date()).getTime().toString()
    }

    this.hbase_cli.putRow(this.HBASE_BIN_TABLE, url_hash, dict, function (err) {
        if(err)logger.error(pageurl+', data insert to hbase error: '+err);
        else logger.info(pageurl+', data insert to hbase cost '+((new Date()).getTime()-start_time)+' ms');
        if(callback)callback(null);
    });
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
                    if(pipeline.spiderCore.settings['save_content_to_hbase']===true){
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
