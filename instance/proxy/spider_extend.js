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

    this.no_queue_alert_count = 0;
    this.myip = ''
}

/**
 * DIY extract, it happens after spider framework extracted data.
 * @param extracted_info
 * {
        "signal":CMD_SIGNAL_CRAWL_SUCCESS,
        "content":'...',
        "remote_proxy":'...',
        "cost":122,
        "inject_jquery":true,
        "js_result":[],
        "drill_link":{"urllib_alias":[]},
        "drill_count":0,
        "cookie":[],
        "url":'',
        "status":200,
        "origin":{
            "url":link,
            "type":'branch/node',
            "referer":'',
            "url_pattern":'...',
            "save_page":true,
            "cookie":[],
            "jshandle":true,
            "inject_jquery":true,
            "drill_rules":[],
            "script":[],
            "navigate_rule":[],
            "stoppage":-1,
            "start_time":1234
        }
    };
 * @returns {*}
 */
//spider_extend.prototype.extract = function(extracted_info,callback){
//    callback(extracted_info);
//}

/**
 * instead of main framework content pipeline
 * if it do nothing , comment it
 * @param extracted_info (same to extract)
 */
//spider_extend.prototype.pipeline = function(extracted_info){
//    logger.debug('spider extender receive extracted info from '+extracted_info['url']);
//}
/**
 * report extracted data lacks of some fields
 */
spider_extend.prototype.data_lack_alert = function(url,fields){
    logger.error(url + ' lacks of :'+fields.join(' and '));
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
                            'url': 'http://61.155.182.29:1337/',//echo server:http://echo.jsontest.com/key/value/one/two
                            'headers': {
                                "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36"
                            },
                            'timeout':60*1000,
                            'proxy':'http://'+ip
                        }, function(error, response, body){
                            if (!error && response.statusCode == 200) {
                                if(body.startsWith('{')){
                                    try{
                                        var info = JSON.parse(body);
                                    }catch(e){
                                        logger.error('proxy checker: json parse error: '+ip);
                                        return cb();
                                    };

                                    var available_proxy = true;
                                    if(!info['IP']||!info['HEADERS'])available_proxy = false;
                                    if(info['HEADERS']){
                                        if(info['HEADERS']['REMOTE_ADDR']&&info['HEADERS']['REMOTE_ADDR']==self.myip)available_proxy = false;
                                        if(info['HEADERS']['X-REAL-IP']&&info['HEADERS']['X-REAL-IP']==self.myip)available_proxy = false;
                                        //strict mode
                                        //if(info['HEADERS']['HTTP_VIA'])available_proxy = false;
                                        //if(info['HEADERS']['HTTP_X_FORWARDED_FOR'])available_proxy = false;
                                        //if(info['HEADERS']['X-FORWARDED-FOR'])available_proxy = false;
                                        //if(info['HEADERS']['X-REAL-IP'])available_proxy = false;
                                        if(info['HEADERS']['HTTP_X_FORWARDED_FOR']&&info['HEADERS']['HTTP_X_FORWARDED_FOR'].indexOf(self.myip)>0)available_proxy = false;
                                        if(info['HEADERS']['X-FORWARDED-FOR']&&info['HEADERS']['X-FORWARDED-FOR'].indexOf(self.myip)>0)available_proxy = false;
                                    }

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
    if(self.myip)self.__fetchProxy(crawled_info);
    else{
        httpRequest.request('http://61.155.182.29:1337/',null,null,null,30,false,function(err,status_code,content,page_encoding){//echo server:http://61.155.182.29:1337/
                if(err)throw err;
                else{
                    var content_json = JSON.parse(content);
                    self.myip = content_json['IP'];
                    self.__fetchProxy(crawled_info);
                }
        });
    }
}
/**
 * report no queue
 */
/*
spider_extend.prototype.no_queue_alert = function(){
    this.no_queue_alert_count++;
    var spider_extend = this;
    if(this.no_queue_alert_count%this.spiderCore.settings['spider_concurrency']!=0)return;
    this.redis_cli.exists('lock:proxy:moving',function(err,value){
        if(err)return;
        if(value===1){
            logger.debug('lock:proxy:moving -> true');
        }else{

            async.series([
                function(callback){
                    spider_extend.redis_cli.set('lock:proxy:moving',1,function(e,s){
                        if(e)logger.debug('lock proxy moving failure');
                        else logger.debug('lock proxy moving successful');
                        callback(e, 'lock');
                    });

                },
                function(callback){
                    spider_extend.redis_cli.expire('lock:proxy:moving',180,function(e,s){
                        if(e)logger.debug('set lock expiration failure');
                        else logger.debug('set lock expiration successful');
                        callback(e, 'expire');
                    });
                },
                function(callback){
                    spider_extend.redis_cli.get('updated:proxy:lib',function(err1,uptime){
                        if(err1)return callback(err1, 'checknew');;
                        var lastUpdate = parseInt(uptime);
                        if((new Date()).getTime() - lastUpdate > 3600000){
                            spider_extend.redis_cli.llen('proxy:public:available:temp',function(err2,quantity){
                                if(err2)return callback(err2, 'tempLength');;
                                if(quantity > 500){
                                    logger.debug(quantity + 'proxies in temporary lib, start to move.');
                                    spider_extend.redis_cli.del('proxy:public:available:3s',function(err3,signal){
                                        if(err3)return callback(err3, 'cleanProxy');;
                                        (function(count){
                                            var myarguments = arguments;
                                            spider_extend.redis_cli.rpoplpush('proxy:public:available:temp','proxy:public:available:3s',function(err4,signal2){
                                                if(err4)return callback(err4, 'moveProxy');;
                                                count++;
                                                logger.debug('moved proxy no.' + count + ' from proxy:public:available:temp to proxy:public:available:3s');
                                                if(!signal2){
                                                    logger.debug('Seems to have completed the move.');
                                                    spider_extend.redis_cli.del('lock:proxy:moving',function(er,sgn){
                                                        if(er)return callback(er, 'unlockFailure');;
                                                        logger.debug('unlock proxy moving');
                                                        spider_extend.redis_cli.set('updated:proxy:lib',(new Date()).getTime(),function(err,result){
                                                            logger.debug('refresh updated:proxy:lib');
                                                            callback(null, 'unlockSuccessful');
                                                        });
                                                    });
                                                }else {
                                                    myarguments.callee(count);
                                                }
                                            });
                                        })(0);
                                    });
                                }
                            });
                        }
                    });
                }
                ],
                // optional callback
                function(err, results){
                    // results is now equal to ['one', 'two']
                });


        }
    });
}
*/
module.exports = spider_extend;