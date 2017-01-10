/**
 * spider core
 */
var util = require('util');
var events = require('events');
var path = require('path');
var async = require('async');
const co = require('co');
let logger;

////spider core/////////////////////////////////////////
var spiderCore = function (settings) {
  events.EventEmitter.call(this);//eventemitter inherits
  this.settings = settings;
  logger = settings.logger;
  this.spider = new (require('./spider.js'))(this);
  this.downloader = new (require('./downloader.js'))(this);
  this.extractor = new (require('./extractor.js'))(this);
  this.pipeline = new (require('./pipeline.js'))(this);
  this.spider_extend = new (require(util.format('../instance/%s/spider_extend.js', settings['instance'])))(this);
};

util.inherits(spiderCore, events.EventEmitter);//eventemitter inherits

/**
 * initialization
 */
spiderCore.prototype.assembly = function () {
  var self = this;
  async.series([
    function (callback) {
      self.spider.assembly(callback);
    },
    function (callback) {
      self.downloader.assembly(callback);
    },
    function (callback) {
      self.extractor.assembly(callback);
    },
    function (callback) {
      self.pipeline.assembly(callback);
    },
    function (callback) {
      if ('assembly' in self.spider_extend) self.spider_extend.assembly(callback);
      else callback();
    }
  ], function (err, result) {
    if (err) logger.error(err);
    self.spider.refreshDrillerRules();
  });
};

////start///////////////////////////////////////////////
spiderCore.prototype.start = function () {
  var spiderCore = this;
  //when get a new url from candidate queue
  this.on('new_url_queue', function (urlinfo) {
    console.log(1111)
    this.spider.updateLinkState(urlinfo['url'], 'crawling');
    this.downloader.download(urlinfo);
    if ('crawl_start_alert' in spiderCore.spider_extend) spiderCore.spider_extend.crawl_start_alert(urlinfo);
  });
  //when downloading is finish
  this.on('crawled', function (crawled_info) {
    console.log(22222)
    logger.info('crawl ' + crawled_info['url'] + ' finish, proxy:' + crawled_info['remote_proxy'] + ', cost:' + ((new Date()).getTime() - parseInt(crawled_info['origin']['start_time'])) + 'ms');
    if (this.extractor.validateContent(crawled_info)) {
      //if(crawled_info['content'].length<500)logger.warn(util.format('Strange content, length:%s, url:%s',crawled_info['content'].length,crawled_info['url']));
      var extracted_info = this.extractor.extract(crawled_info);
      //saving
      async.series([
          function (callback) {
            if ('extract' in spiderCore.spider_extend) {
              spiderCore.spider_extend.extract(extracted_info, function (new_extracted_info) {
                extracted_info = new_extracted_info;
                callback();
              });//spider extend
            } else callback();
          },
          function (callback) {
            spiderCore.pipeline.save(extracted_info, callback);
          },
          function (callback) {
            spiderCore.spider.updateLinkState(crawled_info['url'], 'crawled_finish', callback);
          },
          function (callback) {
            if ('crawl_finish_alert' in spiderCore.spider_extend) spiderCore.spider_extend.crawl_finish_alert(crawled_info);
            callback();
          }
        ],
        function (err, results) {
          if (err) logger.error(err);
          if (extracted_info) {
            if (extracted_info['gc']) extracted_info = null;//FGC
            else extracted_info['gc'] = true;
          }
          spiderCore.emit('slide_queue');
        });
    } else {
      logger.error(util.format('invalidate content %s', crawled_info['url']));
      crawled_info['origin']['void_proxy'] = crawled_info['remote_proxy'];
      spiderCore.spider.retryCrawl(clone(crawled_info['origin']));
      extracted_info = null;//FGC
    }
  });
  //when downloading is failure
  this.on('crawling_failure', function (urlinfo, err_msg) {
    console.log(333333)
    logger.warn(util.format('Crawling failure: %s, reason: %s', urlinfo['url'], err_msg));
    this.spider.retryCrawl(urlinfo);
  });
  //when downloading is break
  this.on('crawling_break', function (urlinfo, err_msg) {
    console.log(44444)
    logger.warn(util.format('Crawling break: %s, reason: %s', urlinfo['url'], err_msg));
    this.spider.retryCrawl(urlinfo);
  });
  //pop a finished url, append a new url
  this.on('slide_queue', function () {
    console.log(55555)
    var spiderCore = this;
    setTimeout(function () {
      if (spiderCore.spider.queue_length > 0) spiderCore.spider.queue_length--;
      spiderCore.spider.checkQueue(spiderCore.spider);
    }, spiderCore.settings['spider_request_delay'] * 1000);
  });
  //once driller reles loaded
  this.once('driller_rules_loaded', function (rules) {
    console.log(6666)
    this.emit('slide_queue');
    var spiderIns = this.spider;
    setInterval(function () {
      spiderIns.checkQueue(spiderIns);
    }, 10000);
  });

  //trigger
  this.assembly();
};

//test url//////////////////////////////////////////////
spiderCore.prototype.test = function (link) {
  var self = this;
  this.on('standby', function (middleware) {
    logger.debug(middleware + ' stand by');
    delete this.unavailable_middlewares[middleware];
    if (isEmpty(this.unavailable_middlewares)) {
      logger.debug('All middlewares stand by');
      this.removeAllListeners('standby');
      this.spider.refreshDrillerRules();
    }
  });

  this.on('crawled', function (crawled_info) {
    logger.debug('crawl ' + crawled_info['url'] + ' finish');
    if (!this.extractor.validateContent(crawled_info)) {
      logger.error(util.format('invalidate content %s', crawled_info['url']));
    }
    //if(crawled_info['content'].length<500)logger.warn(util.format('Strange content, length:%s, url:%s',crawled_info['content'].length,crawled_info['url']));
    var extracted_info = this.extractor.extract(crawled_info);
    if ('extract' in self.spider_extend) self.spider_extend.extract(extracted_info, function (extracted_info) {
      self.pipeline.save(extracted_info);
    });//spider extend
    else self.pipeline.save(extracted_info);
    //if('crawl_finish_alert' in this.spider_extend)this.spider_extend.crawl_finish_alert(crawled_info);
  });

  this.once('driller_rules_loaded', function (rules) {
    var urlinfo = this.spider.wrapLink(link);
    if (urlinfo != null) this.downloader.download(urlinfo);
    else logger.error('no related rules in configure!, ' + link);
  });

  //trigger
  this.assembly();
};
////////////////////////////////////////////////////////
module.exports = spiderCore;
