/**
 * Created by james on 13-11-22.
 * pipeline middleware
 */
var crypto = require('crypto');
var redis = require("redis");
var HBase = require('hbase-client');
var os = require("os");
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
pipeline.prototype.save_links = function(page_url,version,linkobjs,drill_relation){
    var spiderCore = this.spiderCore;
    var redis_cli0 = this.redis_cli0;
    var redis_cli1 = this.redis_cli1;
            for(alias in linkobjs){
                var links = linkobjs[alias];
                for(i=0;i<links.length;i++){
                    var link = links[i];
                    (function(pageurl,alias,link){
                        //--push url to queue--begin--
                        redis_cli0.rpush(alias,link,function(err, value){
                            if(err)throw(err);
                            logger.debug('push url: '+link+' to urllib: '+alias);

                            var kk = crypto.createHash('md5').update(link+'').digest('hex');
                            redis_cli1.hgetall(kk,function(err, value){
                                if(err)return;
                                if(value){
                                    logger.debug('url info exists, '+link+', just update the version');
                                    if(version>parseInt(value['version'])){
                                        redis_cli1.hset(kk,'version',version,function(err, svalue){
                                            if(err){loggeer.error(err);return;}
                                            logger.debug('update url('+link+') version, '+value['version']+' -> '+version);
                                        });
                                    }else logger.debug(link+' keep the version: '+value['version']);
                                }else{
                                    var vv = {
                                        'url':link,
                                        'version':version,
                                        'trace':alias,
                                        'referer':pageurl,
                                        'drill_relation':drill_relation?drill_relation:'*',
                                        'create':(new Date()).getTime(),
                                        'records':JSON.stringify([]),
                                        'last':(new Date()).getTime(),
                                        'status':'hit'
                                    }
                                    redis_cli1.hmset(kk,vv,function(err, value){
                                        if (err) throw(err);
                                        logger.debug(' save url('+link+') to urlinfo.');
                                    });
                                }
                            });
                        });
                        //--push url to queue--end--
                    })(page_url,alias,link);
                }
            }
}
/**
 * save content to hbase(default), if pipeline defined in spider_extend, it will be covered.
 * @param pageurl
 * @param content
 * @param referer
 * @param urllib
 */
pipeline.prototype.save_content = function(pageurl,content,extracted_data,js_result,referer,urllib,drill_relation){
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

    if(content&&!content.isEmpty()){
        dict['basic:content'] = content;
    }

    if(extracted_data&&!extracted_data.isEmpty()){
        for(d in extracted_data){
            if(extracted_data.hasOwnProperty(d)&&extracted_data[d]!=undefined){
                dict['data:'+d] = typeof(extracted_data[d])=='object'?JSON.stringify(extracted_data[d]):extracted_data[d];
            }
        }
    }

    if(js_result&&!js_result.isEmpty()){
        dict['basic:jsresult'] = js_result;
    }

    this.hbase_cli.putRow(this.HBASE_TABLE, url_hash, dict, function (err) {
        if(err)logger.error('Data insert to hbase error: '+err);
        else logger.debug('Data insert to hbase cost '+((new Date()).getTime()-start_time)+' ms');
    });
}
/**
 * pipeline save entrance
 * @param extracted_info
 */
pipeline.prototype.save =function(extracted_info){
    if(this.spiderCore.settings['test']){
        var fs = require('fs');
        var path = require('path');
        if(extracted_info['origin']['format']=='binary'){
            var dumpfile = path.join(__dirname,'..', 'instance',this.spiderCore.settings['instance'],'logs','dumpfile.jpg');
            fs.writeFile(dumpfile,extracted_info['content'],'utf8',function(err){
                if (err)throw err;
                logger.debug('Crawling file saved, '+dumpfile);
            });
        }else{
            var htmlfile = path.join(__dirname,'..', 'instance',this.spiderCore.settings['instance'],'logs','debug-page.html');
            var resultfile = path.join(__dirname,'..', 'instance',this.spiderCore.settings['instance'],'logs','debug-result.json');
            fs.writeFile(htmlfile,extracted_info['content'],'utf8', function (err) {
                if (err)throw err;
                logger.debug('Content saved, '+htmlfile);
            });
	    delete extracted_info['content'];
            fs.writeFile(resultfile,JSON.stringify(extracted_info),'utf8',function(err){
                if (err)throw err;
                logger.debug('Crawling result saved, '+resultfile);
            });
        }
    }else{
        if(extracted_info['drill_link'])this.save_links(extracted_info['url'],extracted_info['origin']['version'],extracted_info['drill_link'],extracted_info['drill_relation']);
        if(this.spiderCore.settings['save_content_to_hbase']===true){
            var html_content = extracted_info['content'];
            if(!extracted_info['origin']['save_page'])html_content = false;
            this.save_content(extracted_info['url'],html_content,extracted_info['extracted_data'],extracted_info['js_result'],extracted_info['origin']['referer'],extracted_info['origin']['urllib'],extracted_info['drill_relation']);
        }
        if('pipeline' in this.spiderCore.spider_extend)this.spiderCore.spider_extend.pipeline(extracted_info);//spider extend
    }
}

module.exports = pipeline;
