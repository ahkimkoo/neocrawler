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
//spider_extend.prototype.extract = function(extracted_info){
//    return extracted_info;
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