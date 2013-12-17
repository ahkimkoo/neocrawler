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
 * @returns {*}
 */

spider_extend.prototype.extract = function(extracted_info){
    switch(extracted_info['origin']['urllib']){
        case 'urllib:driller:taobao.com:beer_list':
            var json_content = JSON.parse(extracted_info['content']);
            for(var i=0;i<json_content['itemList'].length;i++){
                var itm = json_content['itemList'][i];
                if(itm['commendHref'].startsWith('http://detail.tmall')){
                    if(!extracted_info['drill_link']['urllib:driller:tmall.com:beer_item_tmall'])extracted_info['drill_link']['urllib:driller:tmall.com:beer_item_tmall']=[];
                    extracted_info['drill_link']['urllib:driller:tmall.com:beer_item_tmall'].push(itm['commendHref']);
                }else{
                    if(!extracted_info['drill_link']['urllib:driller:taobao.com:beer_item'])extracted_info['drill_link']['urllib:driller:taobao.com:beer_item']=[];
                    extracted_info['drill_link']['urllib:driller:taobao.com:beer_item'].push(itm['commendHref']);
                }
                for(var x=0;x<Math.ceil(itm['commend']/20);x++){
                    var page = x;
                    var comment_link = util.format('http://rate.taobao.com/feedRateList.htm?userNumId=%d&auctionNumId=%d&currentPageNum=%d&rateType=&orderType=sort_weight&showContent=1',itm['sellerId'],itm['itemId'],page);
                    if(!extracted_info['drill_link']['urllib:driller:taobao.com:comments'])extracted_info['drill_link']['urllib:driller:taobao.com:comments']=[];
                    extracted_info['drill_link']['urllib:driller:taobao.com:comments'].push(comment_link);
                }
            }
            break;

        case 'urllib:driller:taobao.com:comments':
            var atxt = extracted_info['content'].trim().slice(1,-1);
            var json_content = JSON.parse(atxt);
            for(var i=0;i<json_content['comments'].length;i++){
                var c = json_content['comments'][i];
                if(c['user']['nickUrl']){
                    if(!extracted_info['drill_link']['urllib:driller:taobao.com:profile'])extracted_info['drill_link']['urllib:driller:taobao.com:profile']=[];
                    extracted_info['drill_link']['urllib:driller:taobao.com:profile'].push(c['user']['nickUrl']);
                }
            }
            break;
    }
    return extracted_info;
}

/**
 * instead of main framework content pipeline
 * if it do nothing , comment it
 * @param extracted_info (same to extract)
 */
spider_extend.prototype.pipeline = function(extracted_info){
    logger.debug(JSON.stringify(extracted_info));
}

module.exports = spider_extend;