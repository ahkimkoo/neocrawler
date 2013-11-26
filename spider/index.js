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
    var url = 'http://ju.taobao.com/?spm=1.6659421.754904973.2.ALtBmk';
    var script = "jsexec_result = $.map($('.category li a span'),function(n,i) {return $(n).text();});";
    this.emit('new_url_queue',{"url":url,"type":"branch","referer":"http://www.taobao.com","jshandle":true,"inject_jquery":true,"script":script,"navigate_rules":[]});
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