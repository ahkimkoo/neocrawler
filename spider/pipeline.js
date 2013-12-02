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
    this.hbase_cli = hbase({
        host:spiderCore.settings['crawled_hbase_db'][0],
        port:spiderCore.settings['crawled_hbase_db'][1]
    });
    this.hbase_table = this.hbase_cli.getTable('crawled');
}

pipeline.prototype.save_links = function(page_url,linkobjs){
    var spiderCore = this.spiderCore;
    var client0 = redis.createClient(spiderCore.settings['driller_info_redis_db'][1],spiderCore.settings['driller_info_redis_db'][0]);
    var client1 = redis.createClient(spiderCore.settings['url_info_redis_db'][1],spiderCore.settings['url_info_redis_db'][0]);
    client0.select(spiderCore.settings['driller_info_redis_db'][2], function(err,value) {
        if(err)throw(err);
        client1.select(spiderCore.settings['url_info_redis_db'][2], function(err,value) {
            if(err)throw(err);
            for(alias in linkobjs){
                var links = linkobjs[alias];
                for(i=0;i<links.length;i++){
                    var link = links[i];
                    (function(pageurl,alias,link){
                        //--push url to queue--begin--
                        client0.rpush(alias,link,function(err, value){
                            if(err)throw(err);
                            logger.debug('push url: '+link+' to urllib: '+alias);
                            var kk = crypto.createHash('md5').update(link+'').digest('hex');
                            var vv = {
                                'url':link,
                                'referer':pageurl,
                                'create':(new Date()).getTime(),
                                'records':JSON.stringify([]),
                                'status':'hit'
                            }
                            client1.hmset(kk,vv,function(err, value){
                                if (err) throw(err);
                                console.log(' save url info: '+link);
                                client1.quit();
                            });
                                client0.quit();
                        });
                        //--push url to queue--end--
                    })(page_url,alias,link);
                }
            }
        });
    });

}

pipeline.prototype.save_content = function(pageurl,content){
    var url_hash = crypto.createHash('md5').update(pageurl+'').digest('hex');
    var spider = os.hostname()+'-'+process.pid;
    this.hbase_table
            .getRow(url_hash)
            .put('basic:spider',spider,function(err,success){
                      console.log('insert one column '+url_hash+', basic:spider, '+spider);
                  });

    this.hbase_table
            .getRow(url_hash)
            .put('basic:url',pageurl,function(err,success){
                console.log('insert one column '+url_hash+', basic:url, '+pageurl);
            });

    this.hbase_table
            .getRow(url_hash)
            .put('basic:content',content,function(err,success){
                console.log('insert one column '+url_hash+', basic:content, '+content);
            });
}

pipeline.prototype.save =function(extracted_info){
    if(extracted_info['drill_link'])this.save_links(extracted_info['url'],extracted_info['drill_link']);
    if(extracted_info['origin']['save_page'])this.save_content(extracted_info['url'],extracted_info['content']);
}

module.exports = pipeline;