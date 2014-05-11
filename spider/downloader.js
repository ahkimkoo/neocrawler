/**
 * Created by james on 13-11-22.
 * download middleware
 */
var util = require('util');
var urlUtil =  require("url");
var redis = require("redis");
var events = require('events');
var child_process = require('child_process');
var path = require('path');
var http = require('http');
require('../lib/jsextend.js');
var iconv = require('iconv-lite');
var BufferHelper = require('bufferhelper');
try { var unzip = require('zlib').unzip } catch(e) { /* unzip not supported */ }
var logger;

//command signal defined
var CMD_SIGNAL_CRAWL_SUCCESS = 1;
var CMD_SIGNAL_CRAWL_FAIL = 3;
var CMD_SIGNAL_NAVIGATE_EXCEPTION = 2;

var downloader = function(spiderCore){
    events.EventEmitter.call(this);//eventemitter inherits
    this.spiderCore = spiderCore;
    this.proxyList = [];
    logger = spiderCore.settings.logger;
}

util.inherits(downloader, events.EventEmitter);//eventemitter inherits

////report to spidercore standby////////////////////////
downloader.prototype.assembly = function(){
    /*
    var downloader = this;
    var MIN_PROXY_LENGTH = 1000;
    downloader.on('gotProxyList',function(label,proxylist){
        if(proxylist&&proxylist.length>0)downloader.tmp_proxyList = downloader.tmp_proxyList.concat(proxylist);
        switch(label){
            case 'proxy:vip:available:1s':
                if(downloader.tmp_proxyList.length<MIN_PROXY_LENGTH)this.getProxyListFromDb('proxy:vip:available:3s');
                else {
                    downloader.proxyList = downloader.tmp_proxyList;
                    downloader.emit('refreshed_proxy_list',downloader.proxyList);
                }
                break;
            case 'proxy:vip:available:3s':
                if(downloader.tmp_proxyList.length<MIN_PROXY_LENGTH)this.getProxyListFromDb('proxy:public:available:1s');
                else {
                    downloader.proxyList = downloader.tmp_proxyList;
                    downloader.emit('refreshed_proxy_list',downloader.proxyList);
                }
                break;
            case 'proxy:public:available:1s':
                if(downloader.tmp_proxyList.length<MIN_PROXY_LENGTH)this.getProxyListFromDb('proxy:public:available:3s');
                else {
                    downloader.proxyList = downloader.tmp_proxyList;
                    downloader.emit('refreshed_proxy_list',downloader.proxyList);
                }
                break;
            case 'proxy:public:available:3s':
                if(downloader.tmp_proxyList.length<MIN_PROXY_LENGTH)logger.warn(util.format('Only %d proxies !!!',downloader.tmp_proxyList.length));
                if(downloader.tmp_proxyList.length<0)throw new Error('no proxy list');
                else{
                    downloader.proxyList = downloader.tmp_proxyList;
                    downloader.emit('refreshed_proxy_list',downloader.proxyList);
                }
                break;
        }
    });
    this.redis_cli3 = redis.createClient(this.spiderCore.settings['proxy_info_redis_db'][1],this.spiderCore.settings['proxy_info_redis_db'][0]);
    if(this.spiderCore.settings['use_proxy']){
        downloader.redis_cli3.select(downloader.spiderCore.settings['proxy_info_redis_db'][2], function(err,value) {
             if(err)throw(err);
             downloader.refreshProxyList(downloader);
             downloader.on('refreshed_proxy_list',function(proxylist){
                 downloader.spiderCore.emit('standby','downloader');
                 setTimeout(function(){downloader.refreshProxyList(downloader)},10*60*1000);//refresh again after 10 mins
             });
         });

    }else{
        this.spiderCore.emit('standby','downloader');
    }
    */
    this.spiderCore.emit('standby','downloader');
}
/**
 * refresh proxy list from redis db
 * @param downloader
 */
downloader.prototype.refreshProxyList = function(downloader){
    downloader.tmp_proxyList = [];
    downloader.getProxyListFromDb('proxy:vip:available:1s');
}

/**
 * get proxy list from redisdb, emit event
 * @param label
 */
downloader.prototype.getProxyListFromDb = function(label){
    var downloader = this;
    logger.debug(util.format('get proxy list from :%s',label));
    downloader.redis_cli3.lrange(label,0,-1,function(err,proxylist){
        if(err)throw(err);
        downloader.emit('gotProxyList',label,proxylist);
    });
}

////download action/////////////////////
downloader.prototype.download = function (urlinfo){
    if(urlinfo['jshandle'])this.browseIt(urlinfo);
    else this.downloadIt(urlinfo);
}

downloader.prototype.transCookieKvPair = function(json){
    var kvarray = [];
    for(var i=0; i<json.length; i++){
        kvarray.push(json[i]['name']+'='+json[i]['value']);
    }
    return kvarray.join(';');
}

/**
 * just download html stream
 * @param urlinfo
 */
downloader.prototype.downloadIt = function(urlinfo){
    var spiderCore = this.spiderCore;
    var timeOuter = false;

    var pageLink = urlinfo['url'];
    if(urlinfo['redirect'])pageLink = urlinfo['redirect'];

    if(this.spiderCore.settings['use_proxy']===true){
        var proxyRouter = this.spiderCore.settings['proxy_router'].split(':');
        var __host = proxyRouter[0];
        var __port = proxyRouter[1];
        var __path =  pageLink;
    }else{
        var urlobj = urlUtil.parse(pageLink);
        var __host = urlobj['host'];
        var __port = urlobj['port'];
        var __path = urlobj['path'];
//        var __path = pageLink;
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
            "Accept-Encoding":"gzip,deflate,sdch",
            "Accept-Language":"zh-CN,zh;q=0.8,en-US;q=0.6,en;q=0.4",
            "Referer":urlinfo['referer'],
            "Cookie":this.transCookieKvPair(urlinfo['cookie'])
        }
    };
    logger.debug(util.format('Request start, %s',pageLink));
    var req = http.request(options, function(res) {
        logger.debug(util.format('Response, %s',pageLink));

        var result = {
            "remote_proxy":res.headers['remoteproxy'],
            "drill_count":0,
            "cookie":res.headers['Cookie'],
            "url":res.req.path,
            //"statusCode":res.statusCode,
            "origin":urlinfo
        };
        if(result['url'].startsWith('/'))result['url'] = urlUtil.resolve(pageLink,result['url']);
        result['statusCode'] = res.statusCode;
        if(res.statusCode==301){
            if(res.headers['location']){
                result['origin']['redirect'] = res.headers['location'];
                logger.debug(pageLink+' 301 Moved Permanently to '+res.headers['location']);
            }
        }

        var compressed = /gzip|deflate/.test(res.headers['content-encoding']);

        var bufferHelper = new BufferHelper();
//        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            bufferHelper.concat(chunk);
        });

        res.on('end', function (chunk) {
            if(timeOuter){
                clearTimeout(timeOuter);
                timeOuter = false;
            }
            result["cost"] = (new Date()) - startTime;


            var page_encoding = urlinfo['encoding'];

            if(page_encoding==='auto'){
                page_encoding =
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
            }

            page_encoding = page_encoding.toLowerCase().replace('\-','')
            if(!compressed || typeof unzip == 'undefined'){
                if(urlinfo['format']=='binary'){
                    result["content"] = bufferHelper.toBuffer();
                }else{
                    result["content"] = iconv.decode(bufferHelper.toBuffer(),page_encoding);//page_encoding
                }
                spiderCore.emit('crawled',result);
            }else{
                unzip(bufferHelper.toBuffer(), function(err, buff) {
                    if (!err && buff) {
                        if(urlinfo['format']=='binary'){
                            result["content"] = buff;
                        }else{
                            result["content"] = iconv.decode(buff,page_encoding);
                        }
                        spiderCore.emit('crawled',result);
                    }
                });
            }
        });
    });

    timeOuter = setTimeout(function(){
        if(req){
            logger.error('download timeout, '+pageLink);
            req.destroy();
            spiderCore.emit('crawling_failure',urlinfo,'download timeout');
        }
    },spiderCore.settings['download_timeout']*1000);

    req.on('error', function(e) {
        logger.error('problem with request: ' + e.message+', url:'+pageLink);
        spiderCore.emit('crawling_failure',urlinfo,e.message);
    });
    req.end();
}
/**
 * browser simulated
 * @param urlinfo
 */
downloader.prototype.browseIt = function(urlinfo){
    var spiderCore = this.spiderCore;
    if(this.spiderCore.settings['test']){
        urlinfo['test'] = true;
        urlinfo['ipath'] = path.join(__dirname,'..', 'instance',this.spiderCore.settings['instance'],'logs');
    }
    if(this.spiderCore.settings['use_proxy']===true){
        var phantomjs = child_process.spawn('phantomjs', [
            '--proxy', this.spiderCore.settings['proxy_router'],
            '--load-images', 'false',
            '--local-to-remote-url-access','true',
            //'--cookies-file',path.join(__dirname,'..', 'instance',this.spiderCore.settings['instance'],'logs','cookies.log'),
            'phantomjs-bridge.js',
            JSON.stringify(urlinfo)],
            {'cwd':path.join(__dirname,'..', 'lib','phantomjs'),
                'stdio':'pipe'}
        );
    }else{
        var phantomjs = child_process.spawn('phantomjs', [
            '--load-images', 'false',
            '--local-to-remote-url-access','true',
            //'--cookies-file',path.join(__dirname,'..', 'instance',this.spiderCore.settings['instance'],'logs','cookies.log'),
            'phantomjs-bridge.js',
            JSON.stringify(urlinfo)],
            {'cwd':path.join(__dirname,'..', 'lib','phantomjs'),
                'stdio':'pipe'}
        );
    }

    phantomjs.stdin.setEncoding('utf8');
    phantomjs.stdout.setEncoding('utf8');

    phantomjs.on('error',function(err){logger.error(err);});

    var feedback = '';
    phantomjs.stdout.on('data', function(data) {
        data = data.trim();
        feedback += data;
        if(data.endsWith('}#^_^#')){
            var emit_string = feedback.slice(0,-5);
            feedback = '';
            phantomjs.emit('feedback',emit_string);
        }
    });

    phantomjs.on('feedback', function(data) {
        try{
            var feedback = JSON.parse(data);//data.toString('utf8')
        }catch(e){
            logger.error(util.format('Page content parse error: %s',data));
            spiderCore.emit('crawling_break',urlinfo,e.message);
            phantomjs.kill();
            return;
        }
        switch(feedback['signal']){
            case CMD_SIGNAL_CRAWL_SUCCESS:
                spiderCore.emit('crawled',feedback);
                break;
            case CMD_SIGNAL_CRAWL_FAIL:
                logger.error(feedback.url+' crawled fail');
                phantomjs.kill();
                if(feedback['url']==urlinfo['url'])spiderCore.emit('crawling_failure',urlinfo,'phantomjs crawl failure');
                break;
            case CMD_SIGNAL_NAVIGATE_EXCEPTION:
                logger.error(feedback.url+' navigate fail');
                phantomjs.kill();
                break;
            default:
                logger.debug('Phantomjs: '+data);
        }
    });

    phantomjs.stderr.on('data', function (data) {
        logger.error(data.toString('utf8'));
    });

    phantomjs.on('exit', function (code) {
        logger.error('child process exited with code ' + code);
    });

    phantomjs.on('close', function (signal) {
        logger.error('child process closed with signal ' + signal);
    });

}
////////////////////////////////////////
module.exports = downloader;