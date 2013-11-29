/**
 * spider core
 */
var util = require('util');
var events = require('events');
var redis = require("redis");
var logger;
////spider core/////////////////////////////////////////
var spiderCore = function(settings){
    events.EventEmitter.call(this);//eventemitter inherits
    this.settings = settings;
    this.driller_rules_updated = 0;
    this.driller_rules = {};
    this.downloader = new(require('./downloader.js'))(this);
    this.extractor = new(require('./extractor.js'))(this);
    this.pipeline = new(require('./pipeline.js'))(this);
    logger = settings.logger;
}
util.inherits(spiderCore, events.EventEmitter);//eventemitter inherits
//refresh the driller rules//////////////////////////////
spiderCore.prototype.refreshDrillerRules = function(){
    var spiderCore = this;
    var redis_cli = redis.createClient(this.settings['driller_info_redis_db'][1],this.settings['driller_info_redis_db'][0]);
    redis_cli.select(this.settings['driller_info_redis_db'][2], function(err, value) {
        if (err)throw(err);
        redis_cli.get('updated:driller:rule',function(err,value){
            if (err)throw(err);
            if(this.driller_rules_updated!==parseInt(value)){//driller is changed
                logger.debug('driller rules is changed');

                redis_cli.keys('driller:*',function(err,values){
                    if (err)throw(err);
                    spiderCore.tmp_driller_rules = {};
                    spiderCore.tmp_driller_rules_length = values.length;
                    for(var i=0;i<values.length;i++){
                        (function(key,spiderCore){
                            redis_cli.hgetall(key, function(err,value){//for synchronized using object variable
                                if(spiderCore.tmp_driller_rules==undefined)spiderCore.tmp_driller_rules = {};
                                if(spiderCore.tmp_driller_rules[value['domain']]==undefined)spiderCore.tmp_driller_rules[value['domain']]={};
                                spiderCore.tmp_driller_rules[value['domain']][value['alias']] = value;
                                spiderCore.tmp_driller_rules_length--;
                                if(spiderCore.tmp_driller_rules_length<=0){
                                    spiderCore.driller_rules = spiderCore.tmp_driller_rules;
                                    spiderCore.driller_rules_updated = (new Date()).getTime();
                                    spiderCore.emit('driller_reules_loaded',spiderCore.driller_rules);
                                    setTimeout(function(){spiderCore.refreshDrillerRules();},spiderCore.settings['check_driller_rules_interval']);
                                    redis_cli.quit();
                                }
                            });
                        })(values[i],spiderCore);
                    }
                });
                this.driller_rules_updated=parseInt(value);
            }else{
                logger.debug('driller rules is not changed');
                setTimeout(function(){spiderCore.refreshDrillerRules();},spiderCore.settings['check_driller_rules_interval']);
                redis_cli.quit();
            }
        })

    });
}
////get url////////////////////////////////////////////
spiderCore.prototype.getUrlQueue = function(){
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

    var urlinfo = {
        "url":"http://www.amazon.cn/gp/bestsellers",
        "type":"branch",
        "referer":"http://www.amazon.cn/",
        "save_page":true,
        "cookie":[],
        "jshandle":false,
        "inject_jquery":false,
        "drill_rules":["#zg_browseRoot a"],
        "script":[],
        "navigate_rule":[],
        "stoppage":-1
    }

    this.emit('new_url_queue',urlinfo);
}

////start///////////////////////////////////////////////
spiderCore.prototype.start = function(){
    this.once('driller_reules_loaded',function(rules){
        this.getUrlQueue();
    });

    this.on('new_url_queue',function(urlinfo){
        this.downloader.download(urlinfo);
    });

    this.on('crawled',function(crawled_info){
        var extracted_info = this.extractor.extract(crawled_info);
        this.pipeline.save(extracted_info);
    });

    //trigger
    this.refreshDrillerRules();
}
////////////////////////////////////////////////////////
module.exports = spiderCore;