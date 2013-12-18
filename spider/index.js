/**
 * spider core
 */
var util = require('util');
var events = require('events');
var path = require('path');
require('../lib/jsextend.js');

var logger;
////spider core/////////////////////////////////////////
var spiderCore = function(settings){
    events.EventEmitter.call(this);//eventemitter inherits
    this.settings = settings;
    this.spider = new(require('./spider.js'))(this);
    this.downloader = new(require('./downloader.js'))(this);
    this.extractor = new(require('./extractor.js'))(this);
    this.pipeline = new(require('./pipeline.js'))(this);
    this.spider_extend = new(require(util.format('../instance/%s/spider_extend.js',settings['instance'])))(this);
    logger = settings.logger;
}
util.inherits(spiderCore, events.EventEmitter);//eventemitter inherits

spiderCore.prototype.assembly = function(){
    this.unavailable_middlewares = {
        'spider':true,
        'downloader':true,
        'extractor':true,
        'pipeline':true
    }
    this.spider.assembly();
    this.downloader.assembly();
    this.extractor.assembly();
    this.pipeline.assembly();
}

////start///////////////////////////////////////////////
spiderCore.prototype.start = function(){

    this.on('standby',function(middleware){
        logger.debug(middleware+' stand by');
        delete this.unavailable_middlewares[middleware];
        if(this.unavailable_middlewares.isEmpty()){
            logger.debug('All middlewares stand by');
            this.removeAllListeners('standby');
            this.spider.refreshDrillerRules();
        }
    });

    this.on('new_url_queue',function(urlinfo){
        this.spider.updateLinkState(urlinfo['url'],'crawling');
        this.downloader.download(urlinfo);
    });

    this.on('crawled',function(crawled_info){
        logger.debug('crawl '+crawled_info['url']+' finish, cost:'+((new Date()).getTime() - parseInt(crawled_info['origin']['start_time']))+'ms');
        var extracted_info = this.extractor.extract(crawled_info);
        if('extract' in this.spider_extend)extracted_info = this.spider_extend.extract(extracted_info);//spider extend
        this.pipeline.save(extracted_info);
        this.spider.updateLinkState(crawled_info['url'],'crawled_finish');
        this.emit('slide_queue');
    });

    this.on('crawling_failure',function(url,err_msg){
        logger.warn(util.format('Crawling failure: %s, reason: %s',url,err_msg));
        this.spider.updateLinkState(url,'crawled_failure');
        this.emit('slide_queue');
    });

    this.on('crawling_break',function(url,err_msg){
        logger.warn(util.format('Crawling break: %s, reason: %s',url,err_msg));
        this.emit('slide_queue');
    });

    this.on('slide_queue',function(){
        if(this.spider.queue_length>0)this.spider.queue_length--;
        this.spider.checkQueue(this.spider);
    });

    this.once('driller_reules_loaded',function(rules){
        this.emit('slide_queue');
        var spiderIns = this.spider;
        setInterval(function(){spiderIns.checkQueue(spiderIns);},120000);
    });

    //trigger
    this.assembly();

}

//test url//////////////////////////////////////////////
spiderCore.prototype.test = function(link){
    this.on('standby',function(middleware){
        logger.debug(middleware+' stand by');
        delete this.unavailable_middlewares[middleware];
        if(this.unavailable_middlewares.isEmpty()){
            logger.debug('All middlewares stand by');
            this.removeAllListeners('standby');
            this.spider.refreshDrillerRules();
        }
    });

    this.on('crawled',function(crawled_info){
        logger.debug('crawl '+crawled_info['url']+' finish');
        var extracted_info = this.extractor.extract(crawled_info);
        if('extract' in this.spider_extend)extracted_info = this.spider_extend.extract(extracted_info);
        this.pipeline.save(extracted_info);
    });

    this.once('driller_reules_loaded',function(rules){
        var urlinfo = this.spider.wrapLink(link);
        if(urlinfo!=null)this.downloader.download(urlinfo);
        else logger.error('no related rules in configure!, '+link);
    });

    //trigger
    this.assembly();
}
////////////////////////////////////////////////////////
module.exports = spiderCore;