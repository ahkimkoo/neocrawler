/**
 * Created by james on 13-12-17.
 * spider extend: diy spider
 */
require('../../lib/jsextend.js');
var util = require('util');
var url = require('url');
var crypto = require('crypto');
var MongoClient = require('mongodb').MongoClient;

var spider_extend = function(spiderCore){
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;

    this.mongoTable = null;
    var spider_extend = this;
    MongoClient.connect("mongodb://10.1.1.122:27017/taozuowen", function(err, db) {
        if(err)throw err;
        spider_extend.mongoTable = db.collection('articles');
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
        if(data['content']&&data['content'].trim()!=""){
            var _id = crypto.createHash('md5').update(extracted_info['url']).digest('hex');
            var puerContent = data['content'].replace(/[^\u4e00-\u9fa5a-z0-9]/ig,'');
            var simplefp = crypto.createHash('md5').update(puerContent).digest('hex');

            var currentTime = (new Date()).getTime();
            data['updated'] = currentTime;
            data['published'] = false;

            //drop additional info
            if(data['$category'])delete data['$category'];
            if(data['$require'])delete data['$require'];

            //format relation to array
            if(extracted_info['drill_relation']){
                data['relation'] = extracted_info['drill_relation'].split('->');
            }

            //get domain
            var urlibarr = extracted_info['origin']['urllib'].split(':');
            var domain = urlibarr[urlibarr.length-2];
            data['domain'] = domain;

            logger.debug('get '+data['title']+' from '+domain+'('+extracted_info['url']+')');
            data['url'] = extracted_info['url'];

            var query = {
                "$or":[
                    {
                        '_id':_id
                    },
                    {
                        'simplefp':simplefp
                    }
                ]
            };
            spider_extend.mongoTable.findOne(query, function(err, item) {
                if(err)throw err;
                else{
                    if(item){
                        //if the new data of field less than the old, drop it
                        (function(nlist){
                            for(var c=0;c<nlist.length;c++)
                            if(data[nlist[c]]&&item[nlist[c]]&&data[nlist[c]].length<item[nlist[c]].length)delete data[nlist[c]];
                        })(['title','content','tag','keywords']);

                        spider_extend.mongoTable.update({'_id':item['_id']},{$set:data}, {w:1}, function(err,result) {
                            if(!err)logger.debug('update '+data['title']+' to mongodb, '+data['url']+' --override-> '+item['url']);
                        });
                    }else{
                        data['simplefp'] = simplefp;
                        data['_id'] = _id;
                        data['created'] = currentTime;
                        spider_extend.mongoTable.insert(data,{w:1}, function(err, result) {
                            if(!err)logger.debug('insert '+data['title']+' to mongodb');
                        });
                    }
                }
            });
        }else{
            logger.warn(extracted_info['url']+' is lack of content, drop it');
        }
    }
}

module.exports = spider_extend;