/**
 * Created by james on 13-11-22.
 * download middleware
 */
var util = require('util');
var events = require('events');
var child_process = require('child_process');
var path = require('path');
var http = require('http');
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
downloader.prototype.downloadIt = function(urlinfo){
    var proxyRouter = this.spiderCore.settings['proxy_router'].split(':');
    var dataarray = [];
    var options = {
        hostname: proxyRouter[0],
        port: proxyRouter[1],
        path: urlinfo['url'],
        method: 'GET',
        headers: {
            "User-Agent":"Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36",
            "Referer":urlinfo['referer'],
            "Cookie":"key1=value1; key2=value2"
        }
    };
    var req = http.request(options, function(res) {
        console.log('STATUS: ' + res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('BODY: ' + chunk);
        });
    });

    req.on('error', function(e) {
        logger.error('problem with request: ' + e.message+', url:'+urlinfo['url']);
    });
    req.end();
}
downloader.prototype.browseIt = function(urlinfo){
    var phantomjs = child_process.spawn('phantomjs', [
        '--proxy', this.spiderCore.settings['proxyRouter'],
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
                logger.debug(feedback.url+' crawled, status: '+feedback.status);
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