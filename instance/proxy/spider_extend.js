/**
 * Created by james on 13-12-17.
 * spider extend: diy spider
 */
require('../../lib/jsextend.js');
var util = require('util');
var redis = require("redis");
var request = require('request');

var spider_extend = function(spiderCore){
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;
    this.redis_cli = redis.createClient(6379,'192.168.1.4');
    this.redis_cli.select(3, function(err,value) {
        if(err)throw(err);
        logger.debug('temporarily proxy redis db ready');
    });
    this.no_queue_alert_count = 0;
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
//spider_extend.prototype.extract = function(extracted_info){
//    return extracted_info;
//}

/**
 * instead of main framework content pipeline
 * if it do nothing , comment it
 * @param extracted_info (same to extract)
 */
//spider_extend.prototype.pipeline = function(extracted_info){
//    logger.debug(JSON.stringify(extracted_info));
//}
/**
 * report extracted data lacks of some fields
 */
spider_extend.prototype.data_lack_alert = function(url,fields){
    logger.error(url + ' lacks of :'+fields.join(' and '));
}
/**
 * report a url crawling finish
 * @param crawled_info
 */
spider_extend.prototype.crawl_finish_alert = function(crawled_info){
    if(crawled_info['extracted_data']){
        var ips = crawled_info['extracted_data']['IP'];
        for(var i=0;i<ips.length;i++){
            var ip = ips[i];
            if(typeof(ip)==='object'){
                ip = ip['host'] + ':' + ip['port'];
            }
            (function(ip,redis_cli){
                var startTime = (new Date()).getTime();
                request({
                    'url': 'http://echo.jsontest.com/key/value/one/two',
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
                                logger.error('json parse error: '+ip);
                                return;
                            };

                            if(info['one']&&info['key']){
                                var endTime = (new Date()).getTime();
                                if(endTime - startTime <= 60000){
                                    redis_cli.rpush('proxy:public:available:temp',ip,function(err,value){
                                        if(!err)logger.debug('Append a proxy: '+ip);
                                    });
                                }else{
                                    logger.debug(ip + ' took a long time: '+(endTime - startTime)+'ms, drop it');
                                }
                            }
                        }
                    }
                });
            })(ip,this.redis_cli);
        }
    }
    logger.debug('I see, '+crawled_info['url'] + 'crawling finish.');
}
/**
 * report no queue
 */
spider_extend.prototype.no_queue_alert = function(){
    this.no_queue_alert_count++;
    var spider_extend = this;
    if(this.no_queue_alert_count%this.spiderCore.settings['spider_concurrency']!=0)return;
    this.redis_cli.exists('lock:proxy:moving',function(err,value){
        if(err)return;
        if(value===1){
            logger.debug('lock:proxy:moving -> true');
        }else{
            spider_extend.redis_cli.set('lock:proxy:moving',1,function(e,s){
                if(e)return;
                spider_extend.redis_cli.expire('lock:proxy:moving',180,function(e,s){
                    if(e)return;
                    logger.debug('lock proxy moving');
                });
            });

            spider_extend.redis_cli.get('updated:proxy:lib',function(err1,uptime){
                if(err1)return;
                var lastUpdate = parseInt(uptime);
                if((new Date()).getTime() - lastUpdate > 3600000){
                    spider_extend.redis_cli.llen('proxy:public:available:temp',function(err2,quantity){
                        if(err2)return;
                        if(quantity > 100){
                            logger.debug(quantity + 'proxies in temporary lib, start to move.');
                            spider_extend.redis_cli.del('proxy:public:available:3s',function(err3,signal){
                                if(err3)return;
                                (function(count){
                                    var myarguments = arguments;
                                    spider_extend.redis_cli.rpoplpush('proxy:public:available:temp','proxy:public:available:3s',function(err4,signal2){
                                        if(err4)return;
                                        count++;
                                        logger.debug('moved proxy no.' + count + ' from proxy:public:available:temp to proxy:public:available:3s');
                                        if(!signal2){
                                            logger.debug('Seems to have completed the move.');
                                            spider_extend.redis_cli.del('lock:proxy:moving',function(er,sgn){
                                                if(er)return;
                                                logger.debug('unlock proxy moving');
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
    });
}
module.exports = spider_extend;