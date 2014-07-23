/**
 * Created by james on 13-12-17.
 * spider extend: diy spider
 */
require('../../lib/jsextend.js');
var util = require('util');

var spider_extend = function(spiderCore){
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;
}

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

/**
 * instead of main framework content pipeline
 * if it do nothing , comment it
 * @param extracted_info (same to extract)
 */
//spider_extend.prototype.pipeline = function(extracted_info,callback){
//    logger.debug('spider extender receive extracted info from '+extracted_info['url']);
//    callback();
//}
/**
 * report extracted data lacks of some fields
 */
spider_extend.prototype.data_lack_alert = function(url,fields){
    logger.error(url + ' lacks of :'+fields.join(' and '));
}
/**
 * report a url crawling finish
 * @param crawled_info
 */
spider_extend.prototype.crawl_finish_alert = function(crawled_info){
    logger.debug('I see, '+crawled_info['url'] + 'crawling finish.');
}
/**
 * report no queue
 */
spider_extend.prototype.no_queue_alert = function(){
}
module.exports = spider_extend;