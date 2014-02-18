/**
 * Created by james on 13-11-22.
 * pipeline middleware
 */
var crypto = require('crypto');
var redis = require("redis");
var hbase = require('hbase');
var os = require("os");
require('../lib/jsextend.js');

var pipeline = function(spiderCore){
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;
}

////report to spidercore standby////////////////////////
pipeline.prototype.assembly = function(){
    this.hbase_cli = hbase({
        host:this.spiderCore.settings['crawled_hbase_db'][0],
        port:this.spiderCore.settings['crawled_hbase_db'][1]
    });
    this.hbase_table = this.hbase_cli.getTable('crawled');
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
pipeline.prototype.save_links = function(page_url,linkobjs,drill_relation){
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
                            var vv = {
                                'url':link,
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
                                logger.debug(' save url info: '+link);
                                if(spiderCore.settings['test'])spiderCore.emit('append_link',link);
                                //redis_cli1.quit();
                            });
                                //redis_cli0.quit();
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
 * @param pattern
 */
pipeline.prototype.save_content = function(pageurl,content,extracted_data,js_result,referer,pattern,drill_relation){
    var url_hash = crypto.createHash('md5').update(pageurl+'').digest('hex');
    var spider = os.hostname()+'-'+process.pid;

//    var val_cells = [
//                { "column":"basic:spider","timestamp":Date.now(),"$":spider},
//                { "column":"basic:url","timestamp":Date.now(),"$":pageurl},
//                { "column":"basic:content","timestamp":Date.now(),"$":content}
//                ];
        var keylist = ['basic:spider','basic:url','basic:referer','basic:url_pattern','basic:drill_relation'];
        var valuelist = [spider,pageurl,referer,pattern,drill_relation];
        if(content&&!content.isEmpty()){
            keylist.push('basic:content');
            valuelist.push(content);
        }
        if(extracted_data&&!extracted_data.isEmpty()){
            keylist.push('basic:data');
            valuelist.push(JSON.stringify(extracted_data));
        }
        if(js_result&&!js_result.isEmpty()){
            keylist.push('basic:jsresult');
            valuelist.push(js_result);
        }
        var row = this.hbase_table.getRow(url_hash);
    try{
        row.put(keylist,valuelist,function(err,success){
                      logger.debug('insert content extracted from '+pageurl);
                  });
//        row.put(['basic:spider','basic:url','basic:content'],[spider,pageurl,content],function(err,success){
//            logger.debug('insert content extracted from '+pageurl);
//        });
    }catch(e){
        logger.error('use bench mode insert data , err: '+e);
        row.put('basic:spider',spider,function(err, success){
            logger.debug(pageurl+' update basic:spider ');
        });
        row.put('basic:url',pageurl,function(err, success){
            logger.debug(pageurl+' update basic:url ');
        });
        if(content&&!content.isEmpty())
        row.put('basic:content',content,function(err, success){
            logger.debug(pageurl+' update basic:content ');
        });
        if(extracted_data&&!extracted_data.isEmpty())
        row.put('basic:data',JSON.stringify(extracted_data),function(err, success){
            logger.debug(pageurl+' update basic:data ');
        });
        if(js_result&&!js_result.isEmpty())
        row.put('basic:jsresult',js_result,function(err, success){
            logger.debug(pageurl+' update basic:jsresult ');
        });
        row.put('basic:referer',referer,function(err, success){
            logger.debug(pageurl+' update basic:referer ');
        });
        row.put('basic:url_pattern',pattern,function(err, success){
            logger.debug(pageurl+' update basic:url_pattern ');
        });
        row.put('basic:drill_relation',drill_relation,function(err, success){
            logger.debug(pageurl+' update basic:drill_relation ');
        });
    }
}
/**
 * pipeline save entrance
 * @param extracted_info
 */
pipeline.prototype.save =function(extracted_info){
    if(this.spiderCore.settings['test']){
        var fs = require('fs');
        var path = require('path');
        var htmlfile = path.join(__dirname,'..', 'instance',this.spiderCore.settings['instance'],'logs','debug-page.html');
        var resultfile = path.join(__dirname,'..', 'instance',this.spiderCore.settings['instance'],'logs','debug-result.json');
        fs.writeFile(htmlfile,extracted_info['content'],'utf8', function (err) {
            if (err)throw err;
            logger.debug('Content saved, '+htmlfile);
        });
        fs.writeFile(resultfile,JSON.stringify(extracted_info),'utf8',function(err){
            if (err)throw err;
            logger.debug('Crawling result saved, '+resultfile);
        });
    }else{
        if(extracted_info['drill_link'])this.save_links(extracted_info['url'],extracted_info['drill_link'],extracted_info['drill_relation']);
        if('pipeline' in this.spiderCore.spider_extend)this.spiderCore.spider_extend.pipeline(extracted_info);//spider extend
        else{
            var html_content = extracted_info['content'];
            if(extracted_info['origin']['save_page'])html_content = false;
            this.save_content(extracted_info['url'],extracted_info['content'],extracted_info['extracted_data'],extracted_info['js_result'],extracted_info['origin']['referer'],extracted_info['origin']['url_pattern'],extracted_info['drill_relation']);
        }
    }
}

module.exports = pipeline;