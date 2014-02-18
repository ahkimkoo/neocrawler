/**
 * Module dependencies.
 */

var express = require('express');
var controller = require('./routecontroller.js');
var routes = require('./routes')
var http = require('http');
var path = require('path');
var ejs = require('ejs');
var events = require('events');
var stylus = require('stylus')

// constructor
var webconfig = function(webconfigCore){
	events.EventEmitter.call(this);
	this.webconfigCore = webconfigCore;
	logger = webconfigCore.settings.logger;
}

//////////////////////////////////
Date.prototype.Format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1,
        "d+": this.getDate(),
        "h+": this.getHours(),
        "m+": this.getMinutes(),
        "s+": this.getSeconds(),
        "q+": Math.floor((this.getMonth() + 3) / 3),
        "S": this.getMilliseconds()
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}
//////////////////////////////////

ejs.filters.localDate = function(date,fmt) {
    return date.Format(fmt);
};

webconfig.prototype.launch = function(settings){

	var app = express();
	// all environments
	app.set('port', settings['port']);


	app.configure(function(){
	  app.set('views', __dirname + '/views');
	  app.set('view engine', 'ejs');
	  app.use(express.favicon());
	  app.use(express.logger('dev'));
	  //
      app.use(express.cookieParser());
	  app.use(express.session({secret: '1234567890QWERTY'}));
 	  //
	  app.use(express.urlencoded());
	  app.use(express.staticCache({maxObjects: 100, maxLength: 512}));
	  app.use(stylus.middleware({
		src: __dirname + '/views'
		, dest: __dirname + '/public'
		}));
	  app.use(express.static(__dirname + '/public'));
	  app.use(express.bodyParser());
	  app.use(express.methodOverride());
	  app.use(app.router);
	  app.use(express.directory(__dirname + '/public'));
	  app.use(function(req, res, next){
	    throw new Error(req.url + ' not found');
	  });
	  app.use(function(err, req, res, next) {
	    console.log(err);
	    res.send(err.message);
	  });
	});
	// development only
	if ('development' == app.get('env')) {
		app.use(express.errorHandler());
	}

	app.get('/', routes.index);
	controller.mapRoute(app);

	console.log('create server.');
	http.createServer(app).listen(app.get('port'), function(){
		console.log('webconfig server listening on port ' + app.get('port'));
	});
}
////////////////////////////////////////
module.exports = webconfig;
