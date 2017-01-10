/**
 * Created by james on 13-12-17.
 * spider extend: diy spider
 */
require('../../lib/jsextend.js');
var util = require('util');
const store = require('../../store');

var spider_extend = function(spiderCore){
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * synchronized assembly spider extender
 * @param callback
 */
//spider_extend.prototype.assembly = function(callback){
//    //do something initiation
//      var self = this;
//      self.reportdb = self.spiderCore.spider.redis_cli2;
//      callback();
//}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * customize downloading
 * urlinfo<object>:{"url":string,"version":long,"type":"branch|node","format":"html|json|binary","encoding":"auto|utf-8|gbk","referer":string,string,"urllib":string,"save_page":true|false,"cookie":array[object],"jshandle":true|false,"inject_jquery":true|false,"drill_rules":object,"drill_relation":object,"validation_keywords":array,"script":array,"navigate_rule":array,"stoppage":int,"start_time":long}
 * callback:
 * parameter 1: error
 * parameter 2: <object>:{
            "remote_proxy":string,
            "drill_count":int,
            "cookie":array or string,
            "url":string,
            "statusCode":int,
            "origin":object==urlinfo,
            "cost":long,
            "content":html string
        }
 * if all parameter return null, means give up customize downloading, use built-in download middleware
 */
//spider_extend.prototype.download = function(urlinfo,callback){
//    callback(null,null);
//}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * DIY extract, it happens after spider framework extracted data.
 * @param extracted_info
 * {
        "signal":CMD_SIGNAL_CRAWL_SUCCESS,
        "content":'...',
        "remote_proxy":'...',
        "cost":122,
        "extracted_data":{"field":"value"...}
        "inject_jquery":true,
        "js_result":[],
        "drill_link":{"urllib_alias":[]},
        "drill_count":0,
        "cookie":[],
        "url":'',
        "status":200,
        "origin":{
            "url":link,
            "type":'branch/node',
            "referer":'',
            "url_pattern":'...',
            "save_page":true,
            "cookie":[],
            "jshandle":true,
            "inject_jquery":true,
            "drill_rules":[],
            "script":[],
            "navigate_rule":[],
            "stoppage":-1,
            "start_time":1234
        }
    };
 */
//spider_extend.prototype.extract = function(extracted_info,callback){
//    callback(extracted_info);
//}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * customizing pipeline
 * if it do nothing , comment it
 * @param extracted_info (same to extract)
 */
spider_extend.prototype.pipeline = function(info, callback){
  if(info.statusCode === 200 && info.extracted_data){
    const data = info.extracted_data;
    const title = data.title;
    let content = data.content;
    const img = data.img;
    const keywords = data.keywords;
    const description = data.description;
    if(Object.prototype.toString.call(content) === '[object Array]'){
      content = content.join(' ');
    }
    const item = {
      link: info.url,
      title,
      keywords,
      description,
      content,
      img,
      sitename: "39健康",
    };
    store.update(item, info.drill_count === 0, info);
  }
 callback();
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * it happens crawl started
 * @param urlinfo
 */
//spider_extend.prototype.crawl_start_alert = function(urlinfo){
//    this.reportdb.hincrby('count:'+__getDateStr(),'crawl:'+__getTopLevelDomain(urlinfo['url']),1);
//}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * report retry crawl
 * @param urlinfo:{
            "url":link,
            "type":'branch/node',
            "referer":'',
            "url_pattern":'...',
            "save_page":true,
            "cookie":[],
            "jshandle":true,
            "inject_jquery":true,
            "drill_rules":[],
            "script":[],
            "navigate_rule":[],
            "stoppage":-1,
            "start_time":1234
        }
 *
 */
//spider_extend.prototype.crawl_retry_alert = function(urlinfo){
//    this.reportdb.hincrby('count:'+__getDateStr(),'retry:'+__getTopLevelDomain(urlinfo['url']),1);
//}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * report failed crawl
 * @param urlinfo:{
            "url":link,
            "type":'branch/node',
            "referer":'',
            "url_pattern":'...',
            "save_page":true,
            "cookie":[],
            "jshandle":true,
            "inject_jquery":true,
            "drill_rules":[],
            "script":[],
            "navigate_rule":[],
            "stoppage":-1,
            "start_time":1234
        }
 *
 */
//spider_extend.prototype.crawl_fail_alert = function(urlinfo){
//    this.reportdb.hincrby('count:'+__getDateStr(),'fail:'+__getTopLevelDomain(urlinfo['url']),1);
//}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * report extracted data lacks of some fields
 */
//spider_extend.prototype.data_lack_alert = function(url,fields){
//    this.reportdb.hincrby('count:'+__getDateStr(),'lack:'+__getTopLevelDomain(url),1);
//}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * report a url crawling finish
 * @param crawled_info
 */
//spider_extend.prototype.crawl_finish_alert = function(crawled_info){
//    this.reportdb.hincrby('count:'+__getDateStr(),'finish:'+__getTopLevelDomain(crawled_info['url']),1);
//}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * report saving content
 * if it do nothing , comment it
 * @param extracted_info (same to extract)
 */
//spider_extend.prototype.save_content_alert  = function(extracted_info){
//    this.reportdb.hincrby('count:'+__getDateStr(),'save:'+__getTopLevelDomain(extracted_info['url']),1);
//}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * report no queue
 */
//spider_extend.prototype.no_queue_alert = function(){
//}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * TOP Domain,e.g: http://www.baidu.com/sdfdsfdsf  -> baidu.com
 * @param domain
 * @returns {*}
 * @private
 */
//var __getTopLevelDomain = function(link){
//    var urlobj = url.parse(link);
//    var domain = urlobj['hostname'];
//    var arr = domain.split('.');
//    if(arr.length<=2)return domain;
//    else return arr.slice(1).join('.');
//}
/**
 * get date string
 * @returns {string} 20140928
 * @private
 */
//var __getDateStr = function(){
//    var d = new Date();
//    return ''+ d.getFullYear() + (d.getMonth()>9?d.getMonth()+1:'0'+(d.getMonth()+1)) + (d.getDate()>9?d.getDate():'0'+d.getDate());
//}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = spider_extend;
