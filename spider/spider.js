/**
 * Created by james on 13-12-5.
 * spider middleware
 */
var redis = require("redis");
var crypto = require('crypto');
var url =  require("url");
var util = require('util');

var spider = function(spiderCore){
    this.spiderCore = spiderCore;
    this.queue_length = 0;
    this.driller_rules_updated = 0;
    this.driller_rules = {};
    logger = spiderCore.settings.logger;
}

////report to spidercore standby////////////////////////
spider.prototype.assembly = function(){
    this.redis_cli0 = redis.createClient(this.spiderCore.settings['driller_info_redis_db'][1],this.spiderCore.settings['driller_info_redis_db'][0]);
    this.redis_cli1 = redis.createClient(this.spiderCore.settings['url_info_redis_db'][1],this.spiderCore.settings['url_info_redis_db'][0]);
    var spider = this;
    var spiderCore = this.spiderCore;
    this.redis_cli0.select(this.spiderCore.settings['driller_info_redis_db'][2], function(err,value) {
        spider.redis_cli1.select(spiderCore.settings['url_info_redis_db'][2], function(err,value) {
            spiderCore.emit('standby','spider');
        });
    });
}

//refresh the driller rules//////////////////////////////
spider.prototype.refreshDrillerRules = function(){
    var spider = this;
    var redis_cli = this.redis_cli0;
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
                                    spider.spiderCore.emit('driller_rules_loaded',spider.driller_rules);
                                    setTimeout(function(){spider.refreshDrillerRules();},spider.spiderCore.settings['check_driller_rules_interval']*1000);
                                }
                            });
                        })(values[i],spider);
                    }
                });
                this.driller_rules_updated=parseInt(value);
            }else{
                logger.debug('driller rules is not changed, queue length: '+spider.queue_length);
                setTimeout(function(){spider.refreshDrillerRules();},spider.spiderCore.settings['check_driller_rules_interval']*1000);
            }
        })
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
    var redis_driller_db = this.redis_cli0;
    var redis_urlinfo_db = this.redis_cli1;
        redis_driller_db.lpop('queue:scheduled:all',function(err, link){
            //2----------------------------------------------------------------------------------------
            if(!link){
                logger.debug('No queue~');
                return;
            };//no queue
                var linkhash = crypto.createHash('md5').update(link).digest('hex');
                redis_urlinfo_db.hgetall(linkhash,function(err, link_info){
                    //4---------------------------------------------------------------------------------
                    if(err)throw(err);
                    if(!link_info){
                        logger.warn(link+' has no url info, '+linkhash+', we try to match it');
                        var urlinfo = spider.wrapLink(link);
                        if(urlinfo!=null)spider.spiderCore.emit('new_url_queue',urlinfo);
                        else{
                            logger.error(link+' can not match any driller rule, ignore it.');
                            spider.getUrlQueue();
                        }
                    }else{
                        if(!link_info['trace']){
                            logger.warn(link+', url info is incomplete');
                            spider.getUrlQueue();
                        }else{
                            redis_driller_db.hgetall(link_info['trace'].slice(link_info['trace'].indexOf(':')+1),function(err, drillerinfo){
                                //5---------------------------------------------------------------------
                                if(err)throw(err);
                                if(drillerinfo==null){
                                    logger.warn(link+', has no driller info!');
                                    spider.getUrlQueue();
                                }else{
                                    var urlinfo = {
                                        "url":link,
                                        "type":drillerinfo['type'],
                                        "referer":link_info['referer'],
                                        "url_pattern":drillerinfo['url_pattern'],
                                        "urllib":link_info['trace'],
                                        "save_page":JSON.parse(drillerinfo['save_page']),
                                        "cookie":JSON.parse(drillerinfo['cookie']),
                                        "jshandle":JSON.parse(drillerinfo['jshandle']),
                                        "inject_jquery":JSON.parse(drillerinfo['inject_jquery']),
                                        "drill_rules":JSON.parse(drillerinfo['drill_rules']),
                                        "drill_relation_rule":drillerinfo['drill_relation']&&drillerinfo['drill_relation']!='undefined'?JSON.parse(drillerinfo['drill_relation']):'',
                                        "drill_relation":link_info['drill_relation'],
                                        "validation_keywords":drillerinfo['validation_keywords']&&drillerinfo['validation_keywords']!='undefined'?JSON.parse(drillerinfo['validation_keywords']):'',
                                        "script":JSON.parse(drillerinfo['script']),
                                        "navigate_rule":JSON.parse(drillerinfo['navigate_rule']),
                                        "stoppage":parseInt(drillerinfo['stoppage']),
                                        "start_time":(new Date()).getTime()
                                    }
                                    logger.debug('new url: '+link);
                                    spider.queue_length++;
                                    spider.spiderCore.emit('new_url_queue',urlinfo);
                                }
                                //5----------------------------------------------------------------------
                            });
                        }
                    }
                    //4-----------------------------------------------------------------------------------
                });
                //3---------------------------------------------------------------------------------------
        });
}
/**
 * Check how many urls can be append to queue
 * @param spider
 */
spider.prototype.checkQueue = function(spider){
    logger.debug('Check queue, length: '+spider.queue_length);
    var slide_count = this.spiderCore.settings['spider_concurrency'] - spider.queue_length;
    for(var i=0;i<slide_count;i++){
        spider.getUrlQueue();
    }
}
/**
 * TOP Domain,e.g: www.baidu.com  -> baidu.com
 * @param domain
 * @returns {*}
 * @private
 */
spider.prototype.__getTopLevelDomain = function(domain){
    var arr = domain.split('.');
    if(arr.length<=2)return domain;
    else return arr.slice(1).join('.');
}
/**
 * detect link which driller rule matched
 * @param link
 * @returns {string}
 */
spider.prototype.detectLink = function(link){
    var urlobj = url.parse(link);
    var result = '';
    var domain = this.__getTopLevelDomain(urlobj['hostname']);
    if(this.driller_rules[domain]!=undefined){
        var alias = this.driller_rules[domain];
        for(a in alias){
            if(alias.hasOwnProperty(a)){
                //var url_pattern  = decodeURIComponent(alias[a]['url_pattern']);
                var url_pattern  = alias[a]['url_pattern'];
                var patt = new RegExp(url_pattern);
                if(patt.test(link)){
                    result = 'driller:'+domain+':'+a;
                    break;
                }
            }
        }
    }
    return result;
}
/**
 * construct a url info
 * @param link
 * @returns {*}
 */
spider.prototype.wrapLink = function(link){
    var linkinfo = null;
    var driller = this.detectLink(link);
    if(driller!=''){
        var driller_arr = driller.split(':');
        var drillerinfo = this.driller_rules[driller_arr[1]][driller_arr[2]];
        linkinfo = {
            "url":link,
            "type":drillerinfo['type'],
            "referer":'',
            "url_pattern":drillerinfo['url_pattern'],
            "urllib":'urllib:'+driller,
            "save_page":JSON.parse(drillerinfo['save_page']),
            "cookie":JSON.parse(drillerinfo['cookie']),
            "jshandle":JSON.parse(drillerinfo['jshandle']),
            "inject_jquery":JSON.parse(drillerinfo['inject_jquery']),
            "drill_rules":JSON.parse(drillerinfo['drill_rules']),
            "drill_relation_rule":drillerinfo['drill_relation']&&drillerinfo['drill_relation']!='undefined'?JSON.parse(drillerinfo['drill_relation']):'',
            "drill_relation":'*',
            "validation_keywords":drillerinfo['validation_keywords']&&drillerinfo['validation_keywords']!='undefined'?JSON.parse(drillerinfo['validation_keywords']):'',
            "script":JSON.parse(drillerinfo['script']),
            "navigate_rule":JSON.parse(drillerinfo['navigate_rule']),
            "stoppage":parseInt(drillerinfo['stoppage'])
        }
    }
    return linkinfo;
}
/**
 * check retry
 * @param urlinfo
 */
spider.prototype.retryCrawl = function(urlinfo){
    if(urlinfo['retry']){
        if(urlinfo['retry']<5){//5 time retry
            urlinfo['retry']+=1;
            logger.info(util.format('Retry url: %s, time: ',urlinfo['url'],urlinfo['retry']));
            this.spiderCore.emit('new_url_queue',urlinfo);
        }else{
            this.updateLinkState(urlinfo['url'],'crawled_failure');
            logger.error(util.format('after %s reties, give up crawl %s',urlinfo['retry'],urlinfo['url']));
            this.spiderCore.emit('slide_queue');
        }
    }else{
        urlinfo['retry']=1;
        logger.info(util.format('Retry url: %s, time: ',urlinfo['url'],urlinfo['retry']));
        this.spiderCore.emit('new_url_queue',urlinfo);
    }
}


/**
 * update link state to redis db
 * @param link
 * @param state
 */
spider.prototype.updateLinkState = function(link,state){
    var spider = this;
    var urlhash = crypto.createHash('md5').update(link+'').digest('hex');
    this.redis_cli1.hgetall(urlhash,function(err,link_info){
        if(err){logger.error('get state of link('+link+') fail: '+err);return;}
        if(link_info){
            var t_record = link_info['records'];
            var records = [];
            if(t_record!=''&&t_record!='[]'){
                try{
                    records = JSON.parse(t_record);
                }catch(e){
                    logger.error(t_record+' JSON parse error: '+e);
                }
            }
            records.push(state);
            spider.redis_cli1.hmset(urlhash,{'records':JSON.stringify(records),'last':(new Date()).getTime(),'status':state},function(err,link_info){
                if(err)logger.error('update state of link('+link+') fail: '+err);
                else logger.debug('update state of link('+link+') success: '+state);
            });
        }else{
            var trace = spider.detectLink(link);
            if(trace!=''){
                trace = 'urllib:' + trace;
                var urlinfo = {
                    'url':link,
                    'trace':trace,
                    'referer':'',
                    'create':(new Date()).getTime(),
                    'records':JSON.stringify([]),
                    'last':(new Date()).getTime(),
                    'status':state
                }
                spider.redis_cli1.hmset(urlhash,urlinfo,function(err, value){
                    if (err) throw(err);
                    logger.debug('save new url info: '+link);
                });
            }else logger.error(link+' can not match any rules, ignore updating.');
        }
    });
}

module.exports = spider;