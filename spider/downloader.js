/**
 * Created by james on 13-11-22.
 * download middleware
 */
var util = require('util');
var events = require('events');
var child = require('child_process');
var path = require('path');
var logger;

var downloader = function(spiderCore){
    events.EventEmitter.call(this);//eventemitter inherits
    this.spiderCore = spiderCore;
    this.phantomjsPath = path.join(__dirname, '..', 'lib', 'phantomjs', 'phantomjs');
    this.phantomjsScript = 'phantomjs.js';
    logger = spiderCore.settings.logger;
}
util.inherits(downloader, events.EventEmitter);//eventemitter inherits

////download action/////////////////////
downloader.prototype.download = function (urlinfo){
    var spawn = child.spawn;

    var phantomjs = spawn(this.phantomjsPath, ['--proxy', this.spiderCore.settings['proxyRouter'], this.phantomjsScript, '--load-images', 'false']);
    phantomjs.stdin.setEncoding('utf8');
    phantomjs.stdout.setEncoding('utf8');

    phantomjs.on('error',function(err){logger.error(err);});

    //command signal defined
    var CMD_SIGNAL_EXIT = -1;
    var CMD_SIGNAL_STATUS = 0;
    var CMD_SIGNAL_EXCEPTION = 1;
    var CMD_SIGNAL_OPENURL = 10;
    var CMD_SIGNAL_CRAWL_SUCCESS = 20;

    phantomjs.stdout.on('data', function(data) {
        var feedback = JSON.parse(data);
        switch(feedback['signal']){
            case CMD_SIGNAL_CRAWL_SUCCESS:
                this.logger.debug("phantom stdout: " + data);
                break;
        }
    });
}
////////////////////////////////////////
module.exports = downloader;