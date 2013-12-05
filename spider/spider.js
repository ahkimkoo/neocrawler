/**
 * Created by james on 13-12-5.
 * spider middleware
 */
var redis = require("redis");
var crypto = require('crypto');

var spider = function(spiderCore){
    this.spiderCore = spiderCore;
    this.queue_length = 0;
    this.driller_rules_updated = 0;
    this.driller_rules = {};
    logger = spiderCore.settings.logger;
}

////report to spidercore standby////////////////////////
spider.prototype.assembly = function(){
    this.spiderCore.emit('standby','spider');
}

//refresh the driller rules//////////////////////////////
spider.prototype.refreshDrillerRules = function(){
    var spider = this;
    var redis_cli = redis.createClient(spider.spiderCore.settings['driller_info_redis_db'][1],spider.spiderCore.settings['driller_info_redis_db'][0]);
    redis_cli.select(spider.spiderCore.settings['driller_info_redis_db'][2], function(err, value) {
        if (err)throw(err);
        redis_cli.get('updated:driller:rule',function(err,value){
            if (err)throw(err);
            if(this.driller_rules_updated!==parseInt(value)){//driller is changed
                logger.debug('driller rules is changed');

                redis_cli.keys('driller:*',function(err,values){
                    if (err)throw(err);
                    spider.tmp_driller_rules = {};
                    spider.tmp_driller_rules_length = values.length;
                    for(var i=0;i<values.length;i++){
                        (function(key,spider){
                            redis_cli.hgetall(key, function(err,value){//for synchronized using object variable
                                if(spider.tmp_driller_rules==undefined)spider.tmp_driller_rules = {};
                                if(spider.tmp_driller_rules[value['domain']]==undefined)spider.tmp_driller_rules[value['domain']]={};
                                spider.tmp_driller_rules[value['domain']][value['alias']] = value;
                                spider.tmp_driller_rules_length--;
                                if(spider.tmp_driller_rules_length<=0){
                                    spider.driller_rules = spider.tmp_driller_rules;
                                    //spider.driller_rules_updated = (new Date()).getTime();
                                    spider.spiderCore.emit('driller_reules_loaded',spider.driller_rules);
                                    setTimeout(function(){spider.refreshDrillerRules();},spider.spiderCore.settings['check_driller_rules_interval']);
                                    redis_cli.quit();
                                }
                            });
                        })(values[i],spider);
                    }
                });
                this.driller_rules_updated=parseInt(value);
            }else{
                logger.debug('driller rules is not changed');
                setTimeout(function(){spider.refreshDrillerRules();},spider.spiderCore.settings['check_driller_rules_interval']);
                redis_cli.quit();
            }
        })

    });
}
////get url////////////////////////////////////////////
spider.prototype.getUrlQueue = function(){
    /*
     var urlinfo = {
     "url":"http://list.taobao.com/itemlist/sport2011a.htm?spm=1.6659421.a21471u.6.RQYJRM&&md=5221&cat=50071853&sd=0&as=0&viewIndex=1&atype=b&style=grid&same_info=1&tid=0&olu=yes&isnew=2&smc=1&navid=city&_input_charset=utf-8",
     "type":"branch",
     "referer":"http://www.taobao.com",
     "cookie":[],//require('./taobao-cookie-simple.json'),
     "jshandle":true,
     "inject_jquery":false,
     "drill_rules":[".vm-page-next",".general a","a"],
     "script":["jsexec_result = document.getElementById('pageJumpto').value;","jsexec_result=document.querySelector('.user-nick').text"],//["jsexec_result = $.map($('.category li a span'),function(n,i) {return $(n).text();});"],//["jsexec_result=document.querySelector('.user-nick').text;"]
     "navigate_rule":[".vm-page-next"],
     "stoppage":3,
     "url_lib_id":"urllib:driller:taobao.com:list"
     }
     */

    var spider = this;
    var redis_driller_db = redis.createClient(spider.spiderCore.settings['driller_info_redis_db'][1],spider.spiderCore.settings['driller_info_redis_db'][0]);
    var redis_urlinfo_db = redis.createClient(spider.spiderCore.settings['url_info_redis_db'][1],spider.spiderCore.settings['url_info_redis_db'][0]);
    redis_driller_db.select(spider.spiderCore.settings['driller_info_redis_db'][2], function(err, signal) {
        //1-------------------------------------------------------------------------------------------
        if(err)throw(err);
        redis_driller_db.lpop('queue:scheduled:all',function(err, link){
            //2----------------------------------------------------------------------------------------
            if(err)throw(err);
            if(!link){
                logger.debug('No queue~');
                redis_driller_db.quit();
                redis_urlinfo_db.quit();
                return;
            };//no queue
            redis_urlinfo_db.select(spider.spiderCore.settings['url_info_redis_db'][2], function(err, signal) {
                //3-------------------------------------------------------------------------------------
                if(err)throw(err);
                var linkhash = crypto.createHash('md5').update(link).digest('hex');
                redis_urlinfo_db.hgetall(linkhash,function(err, link_info){
                    //4---------------------------------------------------------------------------------
                    if(err)throw(err);
                    if(!link_info){
                        logger.warn(link+' has no url info, '+linkhash);
                        redis_driller_db.quit();
                        redis_urlinfo_db.quit();
                        spider.getUrlQueue();
                    }else{
                        if(!link_info['trace']){
                            logger.warn(link+', url info is incomplete');
                            redis_driller_db.quit();
                            redis_urlinfo_db.quit();
                            spider.getUrlQueue();
                        }else{
                            redis_driller_db.hgetall(link_info['trace'].slice(link_info['trace'].indexOf(':')+1),function(err, drillerinfo){
                                //5---------------------------------------------------------------------
                                if(err)throw(err);
                                if(drillerinfo==null){
                                    logger.warn(link+', has no driller info!');
                                    redis_driller_db.quit();
                                    redis_urlinfo_db.quit();
                                    spider.getUrlQueue();
                                }else{
                                    var urlinfo = {
                                        "url":link,
                                        "type":drillerinfo['type'],
                                        "referer":link_info['referer'],
                                        "save_page":JSON.parse(drillerinfo['save_page']),
                                        "cookie":JSON.parse(drillerinfo['save_page']),
                                        "jshandle":JSON.parse(drillerinfo['jshandle']),
                                        "inject_jquery":JSON.parse(drillerinfo['inject_jquery']),
                                        "drill_rules":JSON.parse(drillerinfo['drill_rules']),
                                        "script":JSON.parse(drillerinfo['script']),
                                        "navigate_rule":JSON.parse(drillerinfo['navigate_rule']),
                                        "stoppage":parseInt(drillerinfo['stoppage'])
                                    }
                                    logger.debug('new url: '+link);
                                    spider.queue_length++;
                                    spider.spiderCore.emit('new_url_queue',urlinfo);
                                    redis_driller_db.quit();
                                    redis_urlinfo_db.quit();
                                }
                                //5----------------------------------------------------------------------
                            });
                        }
                    }
                    //4-----------------------------------------------------------------------------------
                });
                //3---------------------------------------------------------------------------------------
            });
            //2-------------------------------------------------------------------------------------------
        });
        //1---------------------------------------------------------------------------------------------------
    });

}

spider.prototype.checkQueue = function(spider){
    logger.debug('Check queue, length: '+spider.queue_length);
    var slide_count = this.spiderCore.settings['spider_concurrency'] - spider.queue_length;
    for(var i=0;i<slide_count;i++){
        spider.getUrlQueue();
    }
}
//get test url queue
spider.prototype.getTestUrlQueue = function(link){
    var spider = this;
    var redis_driller_db = redis.createClient(spider.spiderCore.settings['driller_info_redis_db'][1],spider.spiderCore.settings['driller_info_redis_db'][0]);
    var redis_urlinfo_db = redis.createClient(spider.spiderCore.settings['url_info_redis_db'][1],spider.spiderCore.settings['url_info_redis_db'][0]);
    redis_driller_db.select(spider.spiderCore.settings['driller_info_redis_db'][2], function(err, signal) {
        //1-------------------------------------------------------------------------------------------
        if(err)throw(err);

        if(err)throw(err);
        if(!link){
            logger.debug('No queue~');
            redis_driller_db.quit();
            redis_urlinfo_db.quit();
            return;
        };//no queue
        redis_urlinfo_db.select(spider.spiderCore.settings['url_info_redis_db'][2], function(err, signal) {
            //3-------------------------------------------------------------------------------------
            if(err)throw(err);
            var linkhash = crypto.createHash('md5').update(link).digest('hex');
            redis_urlinfo_db.hgetall(linkhash,function(err, link_info){
                //4---------------------------------------------------------------------------------
                if(err)throw(err);
                if(!link_info){
                    logger.warn(link+' has no url info, '+linkhash);
                    redis_driller_db.quit();
                    redis_urlinfo_db.quit();
                    spider.getUrlQueue();
                }else{
                    if(!link_info['trace']){
                        logger.warn(link+', url info is incomplete');
                        redis_driller_db.quit();
                        redis_urlinfo_db.quit();
                        spider.getUrlQueue();
                    }else{
                        redis_driller_db.hgetall(link_info['trace'].slice(link_info['trace'].indexOf(':')+1),function(err, drillerinfo){
                            //5---------------------------------------------------------------------
                            if(err)throw(err);
                            if(drillerinfo==null){
                                logger.warn(link+', has no driller info!');
                                redis_driller_db.quit();
                                redis_urlinfo_db.quit();
                                spider.getUrlQueue();
                            }else{
                                var urlinfo = {
                                    "url":link,
                                    "type":drillerinfo['type'],
                                    "referer":link_info['referer'],
                                    "save_page":JSON.parse(drillerinfo['save_page']),
                                    "cookie":JSON.parse(drillerinfo['cookie']),
                                    "jshandle":JSON.parse(drillerinfo['jshandle']),
                                    "inject_jquery":JSON.parse(drillerinfo['inject_jquery']),
                                    "drill_rules":JSON.parse(drillerinfo['drill_rules']),
                                    "script":JSON.parse(drillerinfo['script']),
                                    "navigate_rule":JSON.parse(drillerinfo['navigate_rule']),
                                    "stoppage":parseInt(drillerinfo['stoppage'])
                                }
                                logger.debug('new url: '+JSON.stringify(urlinfo));
                                spider.queue_length++;
                                spider.spiderCore.emit('new_url_queue',urlinfo);
                                redis_driller_db.quit();
                                redis_urlinfo_db.quit();
                            }
                            //5----------------------------------------------------------------------
                        });
                    }
                }
                //4-----------------------------------------------------------------------------------
            });
            //3---------------------------------------------------------------------------------------
        });

        //1---------------------------------------------------------------------------------------------------
    });

}
module.exports = spider;