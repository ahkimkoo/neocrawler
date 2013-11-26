/**
 * Created by james on 13-11-22.
 * download middleware
 */
var util = require('util');
var events = require('events');
var child_process = require('child_process');
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
var CMD_SIGNAL_EXIT = -1;
var CMD_SIGNAL_STATUS = 0;
var CMD_SIGNAL_EXCEPTION = 1;
var CMD_SIGNAL_OPENURL = 10;
var CMD_SIGNAL_JQEXEC = 11;
var CMD_SIGNAL_CRAWL_SUCCESS = 20;
var CMD_SIGNAL_JQEXEC_SUCCESS = 21;

util.inherits(downloader, events.EventEmitter);//eventemitter inherits
////sendCommand/////////////////////////////////////////////////////
downloader.prototype.sendCommand = function(childproc,json){
    //childproc.stdin.resume();
    childproc.stdin.write(JSON.stringify(json));
    childproc.stdin.end();
}
////download action/////////////////////
downloader.prototype.download = function (urlinfo){

    var phantomjs = child_process.spawn('phantomjs', ['--proxy', this.spiderCore.settings['proxyRouter'],'--load-images', 'false','phantomjs.js'],{'cwd':__dirname,'stdio':'pipe'});
    phantomjs.stdin.setEncoding('utf8');
    phantomjs.stdout.setEncoding('utf8');

    phantomjs.on('error',function(err){logger.error(err);});

    var mydownloader = this;

    var feedback = '';
    phantomjs.stdout.on('data', function(data) {
        data = data.trim();
        feedback += data;
        if(data.endsWith('}#^_^#')){
            phantomjs.emit('feedback',feedback.slice(0,-5));
            feedback = '';
        }
    });

    phantomjs.on('feedback', function(data) {
        var feedback = JSON.parse(data);//data.toString('utf8')
        switch(feedback['signal']){
            case CMD_SIGNAL_CRAWL_SUCCESS:
                logger.debug("phantom stdout: " + data);
                //mydownloader.sendCommand(phantomjs,{"signal":CMD_SIGNAL_EXIT,"reason":"demand"});
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

    this.sendCommand(phantomjs,{"signal":CMD_SIGNAL_OPENURL,"url":urlinfo});
}
////////////////////////////////////////
module.exports = downloader;