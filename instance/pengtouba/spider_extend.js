/**
 * Created by james on 13-12-17.
 * spider extend: diy spider
 */
require('../../lib/jsextend.js');
var util = require('util');
var url = require('url');
var MongoClient = require('mongodb').MongoClient;

var spider_extend = function(spiderCore){
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;

    this.mongoTable = null;
    var spider_extend = this;
    MongoClient.connect("mongodb://192.168.1.4:27017/pengtouba", function(err, db) {
        if(err)throw err;
        spider_extend.mongoTable = db.collection('numbers');
    });
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
//spider_extend.prototype.extract = function(extracted_info){
//    return extracted_info;
//}

/**
 * instead of main framework content pipeline
 * if it do nothing , comment it
 * @param extracted_info (same to extract)
 */
spider_extend.prototype.pipeline = function(extracted_info){
    var spider_extend = this;
    if(!extracted_info['extracted_data']||extracted_info['extracted_data'].isEmpty()){
        logger.warn('data of '+extracted_info['url']+' is empty.');
    }else{
        var data = extracted_info['extracted_data'];
        if(data['name']){
            if(data['logo'])data['logo'] = url.resolve(extracted_info['url'],data['logo']);
            if(data['qrcode'])data['qrcode'] = url.resolve(extracted_info['url'],data['qrcode']);
            if(!data['type'])data['type']='wx';
            if(!data['subtype'])data['subtype']='pb';
            var currentTime = (new Date()).getTime();
            data['updated'] = currentTime;
            data['published'] = false;
            if(data['$category'])delete data['$category'];
            if(data['$require'])delete data['$require'];

            var urlibarr = extracted_info['origin']['urllib'].split(':');
            var domain = urlibarr[urlibarr.length-2];
            data['domain'] = domain;

            logger.debug('get '+data['name']+' from '+domain+'('+extracted_info['url']+')');

            data['url'] = extracted_info['url'];

            spider_extend.mongoTable.findOne({'name':data['name'],'type':data['type']}, function(err, item) {
                if(err)logger.error(err);
                else{
                    if(item){
                        spider_extend.mongoTable.update({'_id':item['_id']},{$set:data}, {w:1}, function(err,result) {
                            if(!err)logger.debug('update '+data['name']+' to mongodb');
                        });
                    }else{
                        data['created'] = currentTime;
                        spider_extend.mongoTable.insert(data,{w:1}, function(err, result) {
                            if(!err)logger.debug('insert '+data['name']+' to mongodb');
                        });
                    }
                }
            });
        }else{
            logger.warn(extracted_info['url']+' is lack of name, drop it');
        }
    }
}

module.exports = spider_extend;