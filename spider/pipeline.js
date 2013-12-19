/**
 * Created by james on 13-11-22.
 * pipeline middleware
 */
var crypto = require('crypto');
var redis = require("redis");
var hbase = require('hbase');
var os = require("os");

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

pipeline.prototype.save_links = function(page_url,linkobjs){
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

pipeline.prototype.save_content = function(pageurl,content,referer,pattern){
    var url_hash = crypto.createHash('md5').update(pageurl+'').digest('hex');
    var spider = os.hostname()+'-'+process.pid;

//    var val_cells = [
//                { "column":"basic:spider","timestamp":Date.now(),"$":spider},
//                { "column":"basic:url","timestamp":Date.now(),"$":pageurl},
//                { "column":"basic:content","timestamp":Date.now(),"$":content}
//                ];
        var keylist = ['basic:spider','basic:url','basic:content','basic:referer','basic:url_pattern'];
        var valuelist = [spider,pageurl,content,referer,pattern];
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
        row.put('basic:content',content,function(err, success){
            logger.debug(pageurl+' update basic:content ');
        });
        row.put('basic:referer',referer,function(err, success){
            logger.debug(pageurl+' update basic:referer ');
        });
        row.put('basic:url_pattern',pattern,function(err, success){
            logger.debug(pageurl+' update basic:url_pattern ');
        });
    }
}

pipeline.prototype.save_jsresult = function(pageurl,content,referer,pattern){
    var url_hash = crypto.createHash('md5').update(pageurl+'').digest('hex');
    var spider = os.hostname()+'-'+process.pid;

    var keylist = ['basic:spider','basic:url','basic:jsresult','basic:referer','basic:url_pattern'];
    var valuelist = [spider,pageurl,content,referer,pattern];

    var row = this.hbase_table.getRow(url_hash);
    try{
        row.put(keylist,valuelist,function(err,success){
            logger.debug('insert js result extracted from '+pageurl);
        });
    }catch(e){
        logger.error('use bench mode insert jsresult , err: '+e);

        row.put('basic:spider',spider,function(err, success){
            logger.debug(pageurl+' update basic:spider ');
        });
        row.put('basic:url',pageurl,function(err, success){
            logger.debug(pageurl+' update basic:url ');
        });
        row.put('basic:jsresult',content,function(err, success){
            logger.debug(pageurl+' update basic:jsresult ');
        });
        row.put('basic:referer',referer,function(err, success){
            logger.debug(pageurl+' update basic:referer ');
        });
        row.put('basic:url_pattern',pattern,function(err, success){
            logger.debug(pageurl+' update basic:url_pattern ');
        });
    }
}

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
        if(extracted_info['drill_link'])this.save_links(extracted_info['url'],extracted_info['drill_link']);
        if('pipeline' in this.spiderCore.spider_extend)this.spiderCore.spider_extend.pipeline(extracted_info);//spider extend
        else{
            if(extracted_info['origin']['save_page'])this.save_content(extracted_info['url'],extracted_info['content'],extracted_info['origin']['referer'],extracted_info['origin']['url_pattern']);
            if(extracted_info['js_result']&&extracted_info['js_result'].length>0)this.save_jsresult(extracted_info['url'],extracted_info['js_result'],extracted_info['origin']['referer'],extracted_info['origin']['url_pattern']);
        }
    }
}

module.exports = pipeline;