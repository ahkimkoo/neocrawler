/**
 * proxy collector
 */
var util = require('util');
var events = require('events');

var logger;

////proxy collector core/////////////////////////////////////////
var proxyCollectorCore = function(settings){
    events.EventEmitter.call(this);//eventemitter inherits
    this.settings = settings;
    this.proxyCrawler = new(require('./proxyCrawler.js'))(this);
    logger = settings.logger;

    global.settings = settings;
}
util.inherits(proxyCollectorCore, events.EventEmitter);//eventemitter inherits

////start///////////////////////////////////////////////
proxyCollectorCore.prototype.start = function(){
    console.log("launch proxy collector.");

    this.on('launch_proxyCollector',function(){
        this.proxyCrawler.launch(this.settings);
    });
    this.emit('launch_proxyCollector');

}
////////////////////////////////////////////////////////
module.exports = proxyCollectorCore;