/**
 * Created by james on 13-12-17.
 * spider extend: diy spider
 */
require('../../lib/jsextend.js');
var util = require('util');
var myredis = require('../../lib/myredis.js');
var request = require('request');
var async = require('async');
var httpRequest = require('../../lib/httpRequest.js');

var spider_extend = function(spiderCore){
    var self = this;
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;

    var dbtype = 'redis';
    if(this.spiderCore.settings['use_ssdb'])dbtype = 'ssdb';

    myredis.createClient(
        this.spiderCore.settings['proxy_info_redis_db'][0],
        this.spiderCore.settings['proxy_info_redis_db'][1],
        this.spiderCore.settings['proxy_info_redis_db'][2],
        dbtype,
        function(err,cli){
            self.redis_cli = cli;
            logger.debug('temporarily proxy redis db ready');
     });
}

/**
 * fetch proxy
 * @private
 */
spider_extend.prototype.__fetchProxy = function(crawled_info){
    var self = this;
    if(crawled_info['extracted_data']){
        var ips = crawled_info['extracted_data']['IP'];
        //async queue/////////////////////////////////////////////////////////
        var q = async.queue(function(task, callback) {
            logger.debug('proxy checker: worker '+task.name+' is processing task: ');
            task.run(callback);
        }, 20);
        q.saturated = function() {
            //logger.debug('proxy checker: all workers to be used');
        }
        q.empty = function() {
            //logger.debug('proxy checker: no more tasks wating');
        }
        q.drain = function() {
            logger.debug('proxy checker: all tasks have been processed');
        }
        /////////////////////////////////////////////////////////////////////
        //-------------------------------------------------------------------
        for(var i=0;i<ips.length;i++){
            (function(i,redis_cli){
                q.push({name:'t'+i, run: function(cb){
                    logger.debug('proxy checker: t'+i+' is running, waiting tasks: ', q.length());
                    var ip = ips[i];
                    if(typeof(ip)==='object'){
                        ip = ip['host'].trim() + ':' + ip['port'].trim();
                    }else ip = ip.trim();
                    (function(ip,redis_cli){
                        var startTime = (new Date()).getTime();
                        request({
                            'url': 'http://www.google.com.hk/',
                            'headers': {
                                "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36"
                            },
                            'timeout':60*1000,
                            'proxy':'http://'+ip
                        }, function(error, response, body){
                            if (!error && response.statusCode == 200) {
                                var find = "google";
                                var bm = 100;
                                var reg = new RegExp(find,"ig")
                                var c = body.match(reg);
                                var l = c?c.length:0;

                                if(l>=bm){
                                    var available_proxy = true;
                                    if(available_proxy){
                                        var endTime = (new Date()).getTime();
                                        if(endTime - startTime <= 60000){
                                            redis_cli.lpush('proxy:public:available:3s',ip,function(err,value){
                                                if(!err)logger.debug('proxy checker: Append a proxy: '+ip);
                                                cb();
                                            });
                                        }else{
                                            logger.warn('proxy checker: '+ip + ' took a long time: '+(endTime - startTime)+'ms, drop it');
                                            cb();
                                        }
                                    }else {
                                        logger.warn('proxy checker: ' +ip + ' is invalidate proxy!');
                                        cb();
                                    }
                                }else cb();
                            }else {logger.error('proxy checker: request error: '+ip);cb();}
                        });
                    })(ip,redis_cli);
                }}, function(err) {
                    //logger.debug('proxy checker: t'+i+' executed');
                });
            })(i,this.redis_cli);
        }
        //------------------------------------------------------------------------------
    }
}
/**
 * report a url crawling finish
 * @param crawled_info
 */
spider_extend.prototype.crawl_finish_alert = function(crawled_info){
    var self = this;
    self.__fetchProxy(crawled_info);
}
module.exports = spider_extend;