/**
 * Created by james on 13-12-5.
 * spider middleware
 */

var crypto = require('crypto');
var url = require("url");
var util = require('util');
var async = require('async');
// const Redis = require('ioredis');
const redis = require('../lib/redis');
var logger;

var spider = function (spiderCore) {
  this.spiderCore = spiderCore;
  this.settings = spiderCore.settings;
  this.queue_length = 0;
  this.driller_rules_updated = 0;
  this.driller_rules = {};
  logger = spiderCore.settings.logger;
};

////report to spidercore standby////////////////////////
spider.prototype.assembly = function (callback) {
  var self = this;
  // async.series([
  //   function (cb) {
  //     self.drillerInfoRedis = new Redis(self.spiderCore.settings['driller_info_redis_db']);
  //     self.drillerInfoRedis.connect(cb);
  //   },
  //   function (cb) {
  //     self.urlInfoRedis = new Redis(self.spiderCore.settings['url_info_redis_db']);
  //     self.urlInfoRedis.connect(cb);
  //   },
  //   function (cb) {
  //     self.urlReportRedis = new Redis(self.spiderCore.settings['url_report_redis_db']);
  //     self.urlReportRedis.connect(cb);
  //   }
  // ], function (err, result) {
  //   if (err) logger.error(err);
  //   if (callback) callback(null, result);
  // });
  self.drillerInfoRedis = redis.drillerInfoRedis;
  self.urlInfoRedis = redis.urlInfoRedis;
  self.urlReportRedis = redis.urlReportRedis;
  callback();
};

//refresh the driller rules//////////////////////////////
spider.prototype.refreshDrillerRules = function () {
  var self = this;
  var redis_cli = this.drillerInfoRedis;
  redis_cli.get(`updated:driller:${self.settings['instance']}:rule`, function (err, value) {
    if (err)throw(err);
    if (self.driller_rules_updated !== parseInt(value, 10)) {//driller is changed
      logger.info('driller rules is changed');
      redis_cli.hlist(`driller:${self.settings['instance']}:*`, function (err, values) {
        if (err)throw(err);
        self.tmp_driller_rules = {};
        self.tmp_driller_rules_length = values.length;
        for (var i = 0; i < values.length; i++) {
          self.wrapper_rules(values[i]);
        }
      });
      self.driller_rules_updated = parseInt(value);
    } else {
      logger.debug('driller rules is not changed, queue length: ' + self.queue_length);
      setTimeout(function () {
        self.refreshDrillerRules();
      }, self.spiderCore.settings['check_driller_rules_interval'] * 1000);
    }
  })
}
//wrapper each rule
spider.prototype.wrapper_rules = function (key) {
  var self = this;
  var redis_cli = this.drillerInfoRedis;
  redis_cli.get(key, function (err, value) {//for synchronized using object variable
    value = JSON.parse(value);
    if (self.tmp_driller_rules === undefined) self.tmp_driller_rules = {};
    var isActive = value['active'] === 'true' || value['active'] === true || value['active'] === '1' || value['active'] === 1;
    if (isActive || self.spiderCore.settings['test']) {
      logger.info('Load rule: ' + key);
      if (self.tmp_driller_rules[value['domain']] === undefined) self.tmp_driller_rules[value['domain']] = {};
      self.tmp_driller_rules[value['domain']][value['alias']] = value;
    } else {
      logger.debug('Ignore rule: ' + key + ', status inactive')
    }
    self.tmp_driller_rules_length--;
    if (self.tmp_driller_rules_length <= 0) {
      self.driller_rules = self.tmp_driller_rules;
      //self.driller_rules_updated = (new Date()).getTime();
      self.spiderCore.emit('driller_rules_loaded', self.driller_rules);
      setTimeout(function () {
        self.refreshDrillerRules();
      }, self.spiderCore.settings['check_driller_rules_interval'] * 1000);
    }
  });
};

/**
 * query drillerrule
 * @param id
 * @param name
 */
spider.prototype.getDrillerRule = function (id, name) {
  const rules=this.getDrillerRules(id);
  if(rules!=null){

    if(rules.hasOwnProperty(name)){
      return rules[name];
    }else{
      logger.warn(`no rule: {name} in {id} rules`);
      return null;
    }
  }
};

/**
 * get driller rules dictionary
 * @param id
 * @returns dict{}
 */
spider.prototype.getDrillerRules = function (id) {
  const splited_id = id.split(':');
  let pos = 2;
  if (splited_id[0] === 'urllib') pos = 3;
  if (this.driller_rules[splited_id[pos]] && this.driller_rules[splited_id[pos]][splited_id[pos + 1]]) {
    return this.driller_rules[splited_id[pos]][splited_id[pos + 1]];
  } else {
    logger.warn(`no rules: ${id}`);
    return null;
  }
};

////get url////////////////////////////////////////////
spider.prototype.getUrlQueue = function (callback) {
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
  var drillerInfoRedis = this.drillerInfoRedis;
  var urlInfoRedis = this.urlInfoRedis;
  drillerInfoRedis.lpop('queue:scheduled:all', function (err, link) {
    //2----------------------------------------------------------------------------------------
    if (!link) {
      logger.info(`No candidate queue, ${spider.queue_length} urls in crawling.`);
      if ('no_queue_alert' in spider.spiderCore.spider_extend) spider.spiderCore.spider_extend.no_queue_alert();
      if (callback) {
        callback(false);
        return;
      }
    }
    //no queue
    var linkhash = crypto.createHash('md5').update(link).digest('hex');
    urlInfoRedis.hgetall(linkhash, function (err, link_info) {
      //4---------------------------------------------------------------------------------
      if (err)throw(err);
      if (!link_info || isEmpty(link_info)) {
        logger.warn(link + ' has no url info, ' + linkhash + ', we try to match it');
        var urlinfo = spider.wrapLink(link);
        if (urlinfo != null) spider.spiderCore.emit('new_url_queue', urlinfo);
        else {
          logger.error(link + ' can not match any driller rule, ignore it.');
          spider.getUrlQueue(callback);
        }
      } else {
        if (!link_info['trace']) {
          logger.warn(link + ', url info is incomplete');
          spider.getUrlQueue(callback);
        } else {
          var drillerinfo = spider.getDrillerRules(link_info['trace']);
          if (drillerinfo == null) {
            urlInfoRedis.del(linkhash, function (err) {
              logger.warn(link + ', has dirty driller info! clean it');
              var urlinfo = spider.wrapLink(link);
              if (urlinfo != null) spider.spiderCore.emit('new_url_queue', urlinfo);
              else {
                logger.error('Cleaned dirty driller info for ' + link + ', but can not match any driller rule right now, ignore it.');
                spider.getUrlQueue(callback);
              }
            });
          } else {
            var urlinfo = {
              "url": link,
              "version": parseInt(link_info['version']),
              "type": drillerinfo['type'],
              "format": drillerinfo['format'],
              "encoding": drillerinfo['encoding'],
              "referer": link_info['referer'],
              "url_pattern": drillerinfo['url_pattern'],
              "urllib": link_info['trace'],
              "save_page": drillerinfo['save_page'],
              "cookie": drillerinfo['cookie'],
              "jshandle": drillerinfo['jshandle'],
              "inject_jquery": drillerinfo['inject_jquery'],
              "drill_rules": drillerinfo['drill_rules'],
              "drill_relation": link_info['drill_relation'],
              "validation_keywords": drillerinfo['validation_keywords'] && drillerinfo['validation_keywords'] != 'undefined' ? drillerinfo['validation_keywords'] : '',
              "script": drillerinfo['script'],
              "navigate_rule": drillerinfo['navigate_rule'],
              "stoppage": drillerinfo['stoppage'],
              "start_time": (new Date()).getTime()
            };
            logger.info('new url: ' + link);
            spider.spiderCore.emit('new_url_queue', urlinfo);
            if (callback) callback(true);
          }
        }
      }
      //4-----------------------------------------------------------------------------------
    });
    //3---------------------------------------------------------------------------------------
  });
};

/**
 * Check how many urls can be append to queue
 * @param spider
 */
spider.prototype.checkQueue = function (spider) {
  var breakTt = false;
  async.whilst(
    function () {
      logger.debug('Check queue, length: ' + spider.queue_length);
      return spider.queue_length < spider.spiderCore.settings['spider_concurrency'] && breakTt !== true;
    },
    function (cb) {
      spider.getUrlQueue(function (bol) {
        if (bol === true) spider.queue_length++;
        else breakTt = true;
        cb();
      });
    },
    function (err) {
      if (err) logger.error('Exception in check queue.');
    }
  );
}
/**
 * TOP Domain,e.g: www.baidu.com  -> baidu.com
 * @param domain
 * @returns {*}
 * @private
 */
spider.prototype.__getTopLevelDomain = function (domain) {
  var arr = domain.split('.');
  if (arr.length <= 2)return domain;
  else return arr.slice(1).join('.');
}
/**
 * detect link which driller rule matched
 * @param link
 * @returns {string}
 */
spider.prototype.detectLink = function (link) {
  var urlobj = url.parse(link);
  var result = '';
  var domain = this.__getTopLevelDomain(urlobj['hostname']);
  if (this.driller_rules[domain] != undefined) {
    var alias = this.driller_rules[domain];
    var domain_rules = Object.keys(alias).sort(function (a, b) {
      return alias[b]['url_pattern'].length - alias[a]['url_pattern'].length
    });
    for (var i = 0; i < domain_rules.length; i++) {
      var current_rule = domain_rules[i];
      //var url_pattern  = decodeURIComponent(alias[current_rule]['url_pattern']);
      var url_pattern = alias[current_rule]['url_pattern'];
      var patt = new RegExp(url_pattern);
      if (patt.test(link)) {
        result = 'driller:' + domain + ':' + current_rule;
        break;
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
spider.prototype.wrapLink = function (link) {
  var linkinfo = null;
  var driller = this.detectLink(link);
  if (driller != '') {
    var driller_arr = driller.split(':');
    var drillerinfo = this.driller_rules[driller_arr[2]][driller_arr[3]];
    linkinfo = {
      "url": link,
      "version": (new Date()).getTime(),
      "type": drillerinfo['type'],
      "format": drillerinfo['format'],
      "encoding": drillerinfo['encoding'],
      "referer": "",
      "url_pattern": drillerinfo['url_pattern'],
      "urllib": 'urllib:' + driller,
      "save_page": drillerinfo['save_page'],
      "cookie": drillerinfo['cookie'],
      "jshandle": drillerinfo['jshandle'],
      "inject_jquery": drillerinfo['inject_jquery'],
      "drill_rules": drillerinfo['drill_rules'],
      "drill_relation": '*',
      "validation_keywords": drillerinfo['validation_keywords'] && drillerinfo['validation_keywords'] != 'undefined' ? drillerinfo['validation_keywords'] : '',
      "script": drillerinfo['script'],
      "navigate_rule": drillerinfo['navigate_rule'],
      "stoppage": drillerinfo['stoppage']
    }
  }
  return linkinfo;
}
/**
 * check retry
 * @param urlinfo
 */
spider.prototype.retryCrawl = function (urlinfo) {
  var spider = this;
  var retryLimit = 3;
  if (spider.spiderCore.settings['download_retry'] && spider.spiderCore.settings['download_retry'] != undefined) {
    retryLimit = spider.spiderCore.settings['download_retry'];
  }
  var act_retry = 0;
  if (urlinfo['retry']) act_retry = urlinfo['retry'];

  if (act_retry < retryLimit) {
    urlinfo['retry'] = act_retry + 1;
    logger.info(util.format('Retry url: %s, time: ', urlinfo['url'], urlinfo['retry']));
    spider.spiderCore.emit('new_url_queue', urlinfo);
    if ('crawl_retry_alert' in spider.spiderCore.spider_extend) spider.spiderCore.spider_extend.crawl_retry_alert(urlinfo);//report
  } else {
    spider.updateLinkState(urlinfo['url'], 'crawled_failure');
    logger.error(util.format('after %s reties, give up crawl %s', urlinfo['retry'], urlinfo['url']));
    spider.urlReportRedis.zadd('fail:' + urlinfo['urllib'], urlinfo['version'], urlinfo['url'], function (err, result) {
      spider.spiderCore.emit('slide_queue');
    });
    if ('crawl_fail_alert' in spider.spiderCore.spider_extend) spider.spiderCore.spider_extend.crawl_fail_alert(urlinfo);//report
  }
}


/**
 * update link state to redis db
 * @param link
 * @param state
 */
spider.prototype.updateLinkState = function (link, state, callback) {
  var spider = this;
  var urlhash = crypto.createHash('md5').update(link + '').digest('hex');
  this.urlInfoRedis.hgetall(urlhash, function (err, link_info) {
    if (err) {
      logger.error('get state of link(' + link + ') fail: ' + err);
      if (callback) callback(err);
      return;
    }
    if (link_info && !isEmpty(link_info)) {
      var t_record = link_info['records'];
      var records = [];
      if (t_record != '' && t_record != '[]') {
        try {
          records = JSON.parse(t_record);
        } catch (e) {
          logger.error(t_record + ' JSON parse error: ' + e);
        }
      }
      records.push(state);
      async.parallel([
          function (cb) {
            spider.urlInfoRedis.hmset(urlhash, {
              'records': JSON.stringify(records.length > 3 ? records.slice(-3) : records),
              'last': (new Date()).getTime(),
              'status': state
            }, function (err, link_info) {
              if (err) logger.error('update state of link(' + link + ') fail: ' + err);
              else logger.debug('update state of link(' + link + ') success: ' + state);
              cb(err);
            });
          },
          function (cb) {
            if (state == 'crawled_finish') {
              spider.urlReportRedis.zrem('fail:' + link_info['trace'], link, function (err, result) {
                logger.debug('remove ' + link + ' from fail:' + link_info['trace']);
                cb(err);
              });
            } else cb(null);
          }
        ],
        function (err, results) {
          if (callback) callback(err);
        });
    } else {
      var trace = spider.detectLink(link);
      if (trace != '') {
        trace = 'urllib:' + trace;
        var urlinfo = {
          'url': link,
          'trace': trace,
          'referer': '',
          'create': (new Date()).getTime(),
          'records': JSON.stringify([]),
          'last': (new Date()).getTime(),
          'status': state
        }

        async.parallel([
            function (cb) {
              spider.urlInfoRedis.hmset(urlhash, urlinfo, function (err, value) {
                if (err) throw(err);
                logger.debug('save new url info: ' + link);
                cb(err);
              });
            },
            function (cb) {
              if (state === 'crawled_finish') {
                spider.urlReportRedis.zrem('fail:' + urlinfo['trace'], link, function (err, result) {
                  logger.debug('remove ' + link + ' from fail:' + urlinfo['trace']);
                  cb(err);
                });
              } else cb(null);
            }
          ],
          function (err, results) {
            if (callback) callback(err);
          });
      } else {
        logger.error(link + ' can not match any rules, ignore updating.');
        if (callback) callback(err);
      }
    }
  });
}

module.exports = spider;
