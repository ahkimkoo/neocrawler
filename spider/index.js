/**
 * spider core
 */
var util = require('util');
var events = require('events');
var logger;
////spider core/////////////////////////////////////////
var spiderCore = function(settings){
    events.EventEmitter.call(this);//eventemitter inherits
    this.settings = settings;
    this.downloader = new(require('./downloader.js'))(this);
    logger = settings.logger;
//    this.spider = require('spider.js');
//    this.extractor = require('extractor.js');
//    this.pipeline = require('pipeline.js');
}
util.inherits(spiderCore, events.EventEmitter);//eventemitter inherits

////get url////////////////////////////////////////////
spiderCore.prototype.getUrlQueue = function(){
    var urlinfo = {
        "url":"http://spu.taobao.com/spu/3c/spulist.htm?spm=1.6659421.a21471x.1.W5LzVD&cat=50035191",
        "type":"branch",
        "referer":"http://www.taobao.com",
        "cookie":require('./taobao-cookie-simple.json'),
        "jshandle":true,
        "inject_jquery":false,
        "drill_rules":[".vm-page-next",".general a"],
        "script":["jsexec_result = document.getElementById('pageJumpto').value;","jsexec_result=document.querySelector('.user-nick').text"],//["jsexec_result = $.map($('.category li a span'),function(n,i) {return $(n).text();});"],//["jsexec_result=document.querySelector('.user-nick').text;"]
        "navigate_rule":[".vm-page-next"],
        "stoppage":3
    }
    this.emit('new_url_queue',urlinfo);
}

////start///////////////////////////////////////////////
spiderCore.prototype.start = function(){
    this.on('new_url_queue',function(urlinfo){
        this.downloader.download(urlinfo);
    });
    this.getUrlQueue();
}
////////////////////////////////////////////////////////
module.exports = spiderCore;