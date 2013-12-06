/**
 * webconfig
 */
var util = require('util');
var events = require('events');

var logger;

////webconfig core/////////////////////////////////////////
var webconfigCore = function(settings){
    events.EventEmitter.call(this);//eventemitter inherits
    this.settings = settings;
    this.webconfig = new(require('./webconfig.js'))(this);
    logger = settings.logger;
//    this.spider = require('spider.js');
//    this.extractor = require('extractor.js');
//    this.pipeline = require('pipeline.js');
	global.settings = settings;
}
util.inherits(webconfigCore, events.EventEmitter);//eventemitter inherits

////start///////////////////////////////////////////////
webconfigCore.prototype.start = function(){
	console.log("web config start.");
    this.on('launch_webconfig',function(){
        this.webconfig.launch(this.settings);
    });
    this.emit('launch_webconfig');

}
////////////////////////////////////////////////////////
module.exports = webconfigCore;
