/**
 * Created by cherokee on 14-6-16.
 */

var cheerio = require('cheerio');
var urlUtil =  require("url");
var iconv = require('iconv-lite');
var BufferHelper = require('bufferhelper');
try { var unzip = require('zlib').unzip } catch(e) { console.error('unzip not supported') }
try { var inflate = require('zlib').inflate } catch(e) { console.error('inflate not supported') }
var http = require('http');
require('./jsextend.js');

/**
 * request page
 * callback(err,status_code,content,page_encoding)
*/
var request = function(url,referer,cookie,proxy,timeout,isbin,callback){
    var timeOuter = false;
    var callbackCount = 0;
    if(proxy){
        var proxyRouter = proxy.split(':');
        var __host = proxyRouter[0];
        var __port = proxyRouter[1];
        var __path =  url;
    }else{
        var urlobj = urlUtil.parse(url);
        var __host = urlobj['hostname'];
        var __port = urlobj['port'];
        var __path = urlobj['path'];
    }
    var startTime = new Date();
    var options = {
        'host': __host,
        'port': __port,
        'path': __path,
        'method': 'GET',
        'headers': {
            "User-Agent":"Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36",
            "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            //"Accept-Encoding":"gzip,deflate,sdch",
            "Accept-Encoding":"gzip",
            "Accept-Language":"zh-CN,zh;q=0.8,en-US;q=0.6,en;q=0.4"
        }
    };

    if(cookie){
        var cookie_kvarray = [];
        for(var i=0; i<cookie.length; i++){
            cookie_kvarray.push(cookie[i]['name']+'='+cookie[i]['value']);
        }
        var cookies_str = cookie_kvarray.join(';');
        if(cookies_str.length>0)options['headers']['Cookie'] = cookies_str;
    }

    if(referer)options['headers']['Referer'] = referer;

    var req = http.request(options, function(res) {
        if(res.statusCode==301){
            if(res.headers['location']){
                request(res.headers['location'],referer,cookie,proxy,timeout,isbin,callback);
            }
        }

        var bufferHelper = new BufferHelper();

//        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            bufferHelper.concat(chunk);
        });

        res.on('end', function () {
            console.log('Response end, '+url+' use proxy: '+proxy);
            if(timeOuter){
                clearTimeout(timeOuter);
                timeOuter = false;
            }
            if(!req)return;
            req = null;

            var page_encoding =
                (function(header){
                    var page_encoding = 'UTF-8';
                    //get the encoding from header
                    if(header['content-type']!=undefined){
                        var contentType = res.headers['content-type'];
                        var patt = new RegExp("^.*?charset\=(.+)$","ig");
                        var mts = patt.exec(contentType);
                        if (mts != null)
                        {
                            page_encoding = mts[1];
                        }
                    }
                    return page_encoding;
                })(res.headers);


            page_encoding = page_encoding.toLowerCase().replace('\-','');

            var res_encoding = res.headers['content-encoding'];
            if (res_encoding == 'gzip' && typeof unzip != 'undefined') {
                unzip(bufferHelper.toBuffer(), function(err, buff) {
                    if (!err && buff) {
                        if(isbin){if(callbackCount<1)callback(null,res.statusCode,buff,page_encoding,callbackCount++);}
                        else {if(callbackCount<1)callback(null,res.statusCode,iconv.decode(buff,page_encoding),page_encoding,callbackCount++);}
                    }else {if(callbackCount<1)callback(new Error('gzip no content '+err),res.statusCode,null,page_encoding,callbackCount++);}
                });
            } else if (res_encoding == 'deflate' && typeof inflate != 'undefined') {
                inflate(bufferHelper.toBuffer(), function(err, buff) {
                    if (!err && buff) {
                        if(isbin){if(callbackCount<1)callback(null,res.statusCode,buff,page_encoding,callbackCount++);}
                        else {if(callbackCount<1)callback(null,res.statusCode,iconv.decode(buff,page_encoding),page_encoding,callbackCount++);}
                    }else {if(callbackCount<1)callback(new Error('deflate no content '+err),res.statusCode,null,page_encoding,callbackCount++);}
                });
            } else {
                if(isbin){if(callbackCount<1)callback(null,res.statusCode,bufferHelper.toBuffer(),page_encoding,callbackCount++);}
                else {if(callbackCount<1)callback(null,res.statusCode,iconv.decode(bufferHelper.toBuffer(),page_encoding),page_encoding,callbackCount++);}
            }
        });
    });

    timeOuter = setTimeout(function(){
        if(req){
            console.error('download timeout, '+url+', cost: '+((new Date())-startTime)+'ms ');
            req.abort();//req.destroy();
            req = null;
            if(callbackCount<1)callback(new Error('time out'),504,null,null,callbackCount++);
        }
    },(timeout||30)*1000);

    req.on('error', function(e) {
        console.error('problem with request: ' + e.message+', url:'+url);
        if(timeOuter){
            clearTimeout(timeOuter);
            timeOuter = false;
        }
        if(req){
            req.abort();//req.destroy();
            req = null;
            if(callbackCount<1)callback(new Error('request error'),500,null,null,callbackCount++);
        }
    });
    req.end();
}


exports.request = request;

/**
 * css extract
 * @param content
 * @param expression
 * @param pick
 * @param callback
 * @returns {*}
 */
exports.cssExtract = function(content,expression,pick,callback){
    if(typeof content=='string')var $ = (cheerio.load(content)).root();
    else var $ = content;
    var tmp_val = $.find(expression);
    var val = tmp_val.eq(0);
    var result;
    if(pick.startsWith('@')){
        result = val.attr(pick.slice(1));
    }
    else{
        switch(pick.toLowerCase()){
            case 'text':
            case 'innertext':
                result = val.text();
                break;
            case 'html':
            case 'innerhtml':
                result = val.html();
                break;
        }
    }
    //if(result)result = result.replace(/[\r\n\t]/g, "").trim();
    if(result)result = result.trim();
    return result;
}

/**
 * return matched group base expression
 * @param content
 * @param expression
 * @param index
 * @returns {*}
 */
exports.regexExtract = function(content,expression,index){
    var index = parseInt(index);
    if(index==0)index=1;
    var expression = new RegExp(expression,"ig");
    if(index>0){
        var matched = expression.exec(content);
        if(matched&&matched.length>index)return matched[index];
    }else{
        var arr = [],matched;
        while (matched = expression.exec(content))
            arr.push(matched[1]);
        return arr;
    }

}

exports.getDom = function(content){
    return (cheerio.load(content)).root();
}
