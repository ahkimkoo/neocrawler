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
    var url = 'http://www.amazon.cn/gp/bestsellers';
    this.emit('new_url_queue',{"url":url,"referer":"http://www.amazon.cn","jshandle":true});
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