/**
 * Created by james on 13-11-22.
 * download middleware
 */
var util = require('util');
var events = require('events');
var child_process = require('child_process');
var path = require('path');
var http = require('http');
var iconv = require('iconv-lite');
var BufferHelper = require('bufferhelper');
var logger;

var downloader = function(spiderCore){
    events.EventEmitter.call(this);//eventemitter inherits
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;
}

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

String.prototype.trim= function(){
    return this.replace(/(^\s*)|(\s*$)/g, "");
}

//command signal defined
var CMD_SIGNAL_CRAWL_SUCCESS = 1;
var CMD_SIGNAL_CRAWL_FAIL = 3;
var CMD_SIGNAL_NAVIGATE_EXCEPTION = 2;

util.inherits(downloader, events.EventEmitter);//eventemitter inherits

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
    var proxyRouter = this.spiderCore.settings['proxy_router'].split(':');
    var startTime = new Date();
    var options = {
        'host': proxyRouter[0],
        'port': proxyRouter[1],
        'path': urlinfo['url'],
        'method': 'GET',
        'headers': {
            "User-Agent":"Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36",
            "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
//            "Accept-Encoding":"gzip,deflate,sdch",
            "Accept-Language":"zh-CN,zh;q=0.8,en-US;q=0.6,en;q=0.4",
            "Referer":urlinfo['referer'],
            "Cookie":this.transCookieKvPair(urlinfo['cookie'])
        }
    };

    var req = http.request(options, function(res) {
        var result = {
            "remote_proxy":res.headers['remoteproxy'],
            "drill_count":0,
            "cookie":res.headers['Cookie'],
            "url":res.req.path,
            "status":res.statusCode,
            "origin":urlinfo
        };

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
        })(res.headers)

        var bufferHelper = new BufferHelper();
//        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            bufferHelper.concat(chunk);
        });

        res.on('end', function (chunk) {
            result["content"] = iconv.decode(bufferHelper.toBuffer(),page_encoding);
            result["cost"] = (new Date()) - startTime;
            spiderCore.emit('crawled',result);
        });
    });

    req.on('error', function(e) {
        logger.error('problem with request: ' + e.message+', url:'+urlinfo['url']);
    });
    req.end();
}
/**
 * browser simulated
 * @param urlinfo
 */
downloader.prototype.browseIt = function(urlinfo){
    var spiderCore = this.spiderCore;
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
        var feedback = JSON.parse(data);//data.toString('utf8')
        switch(feedback['signal']){
            case CMD_SIGNAL_CRAWL_SUCCESS:
                spiderCore.emit('crawled',feedback);
                break;
            case CMD_SIGNAL_CRAWL_FAIL:
                logger.error(feedback.url+' crawled fail');
                phantomjs.kill();
            case CMD_SIGNAL_NAVIGATE_EXCEPTION:
                logger.error(feedback.url+' navigate fail');
                phantomjs.kill();
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