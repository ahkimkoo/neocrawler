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
/**
 * initialization
 */
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
    //when every middleware is ready
    this.on('standby',function(middleware){
        logger.debug(middleware+' stand by');
        delete this.unavailable_middlewares[middleware];
        if(this.unavailable_middlewares.isEmpty()){
            logger.debug('All middlewares stand by');
            this.removeAllListeners('standby');
            this.spider.refreshDrillerRules();
        }
    });
    //when get a new url from candidate queue
    this.on('new_url_queue',function(urlinfo){
        this.spider.updateLinkState(urlinfo['url'],'crawling');
        this.downloader.download(urlinfo);
    });
    //when downloading is finish
    this.on('crawled',function(crawled_info){
        logger.debug('crawl '+crawled_info['url']+' finish, proxy:'+crawled_info['remote_proxy']+', cost:'+((new Date()).getTime() - parseInt(crawled_info['origin']['start_time']))+'ms');
        if(this.extractor.validateContent(crawled_info)){
            //if(crawled_info['content'].length<500)logger.warn(util.format('Strange content, length:%s, url:%s',crawled_info['content'].length,crawled_info['url']));
            var extracted_info = this.extractor.extract(crawled_info);
            if('extract' in this.spider_extend)extracted_info = this.spider_extend.extract(extracted_info);//spider extend
            this.pipeline.save(extracted_info);
            this.spider.updateLinkState(crawled_info['url'],'crawled_finish');
            this.emit('slide_queue');
            if('crawl_finish_alert' in this.spider_extend)this.spider_extend.crawl_finish_alert(crawled_info);
        }else{
            logger.error(util.format('invalidate content %s',crawled_info['url']));
            this.spider.retryCrawl(crawled_info['origin']);
        }
    });
    //when downloading is failure
    this.on('crawling_failure',function(urlinfo,err_msg){
        logger.warn(util.format('Crawling failure: %s, reason: %s',urlinfo['url'],err_msg));
        this.spider.retryCrawl(urlinfo);
    });
    //when downloading is break
    this.on('crawling_break',function(urlinfo,err_msg){
        logger.warn(util.format('Crawling break: %s, reason: %s',urlinfo['url'],err_msg));
        this.spider.retryCrawl(urlinfo);
    });
    //pop a finished url, append a new url
    this.on('slide_queue',function(){
        var spiderCore = this;
        setTimeout(function(){
            if(spiderCore.spider.queue_length>0)spiderCore.spider.queue_length--;
            spiderCore.spider.checkQueue(spiderCore.spider);
        },spiderCore.settings['spider_request_delay']*1000);
    });
    //once driller reles loaded
    this.once('driller_rules_loaded',function(rules){
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

    this.once('driller_rules_loaded',function(rules){
        var urlinfo = this.spider.wrapLink(link);
        if(urlinfo!=null)this.downloader.download(urlinfo);
        else logger.error('no related rules in configure!, '+link);
    });

    //trigger
    this.assembly();
}
////////////////////////////////////////////////////////
module.exports = spiderCore;