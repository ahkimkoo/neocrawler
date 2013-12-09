/**
 * proxy router
 */
var http = require('http');
var util = require('util');
var events = require('events');
var url =  require("url");
var logger;

/////////////////////////////////////////////////////////////////
var proxyRouter = function(settings){
	events.EventEmitter.call(this);//eventemitter inherits
	this.settings = settings;
	logger = settings['logger'];
	this.proxyList = {
            'public_1s':[],
			'public_3s':[],
			'public_8s':[]
	}
}

util.inherits(proxyRouter, events.EventEmitter);//eventemitter inherits

proxyRouter.prototype.__getProxyList = function(){
	var proxylist=[];
	
	var redis = require("redis");
	client = redis.createClient(this.settings['proxy_info_redis_db'][1],this.settings['proxy_info_redis_db'][0]);
	
	client.on("error", function (err) {
		logger.error("Redis Error " + err);
    });
	
	var proxyRouterObj = this;
	
	client.select(this.settings['proxy_info_redis_db'][2], function() {
		client.lrange("proxy:public:available:1s",0,-1, function (err, obj) {
			if (err) throw err;
		    for(x in obj){
		    	proxylist.push(obj[x]);
		    }
		    client.quit();
		    proxyRouterObj.proxyList['public_1s'] = proxylist;
		    proxyRouterObj.emit("proxyListChanged", proxyRouterObj.proxyList);
		});
	});
	
}

proxyRouter.prototype.start = function(){
	this.__getProxyList();
	this.once('proxyListChanged',function (proxylist){
		var httpProxyServer = http.createServer(function(request, response) {
            var startTime = (new Date()).getTime();
		  	logger.debug(util.format('Request %s from %s',request.url,request.socket.remoteAddress));
			//var proxy = http.createClient(80, request.headers['host']);
			//var proxy_request = proxy.request(request.method, request.url, request.headers);//202.171.253.98:80
		  	var choseProxy = proxylist['public_1s'][Math.floor(Math.random() * proxylist['public_3s'].length)].split(':');
			var remoteProxyHost = choseProxy[0];
			var remoteProxyPort = choseProxy[1];
            var route = true;

            if(route){
                var proxy_request = http.request({'host':remoteProxyHost,'port':remoteProxyPort,'method':request.method,'path':request.url,'headers':request.headers});
            }else{
                var urlobj = url.parse(request.url);
                var proxy_request = http.request({'host':urlobj['host'],'port':urlobj['port'],'method':request.method,'path':request.url,'headers':request.headers});
            }

            //proxy_request.setSocketKeepAlive(false);
            proxy_request.setTimeout(120000,function(){
                logger.error('Remote request timeout.');
                proxy_request.abort();
                response.end();
            });

			var timer_start = (new Date()).getTime();
			logger.debug(util.format('Request Forward to remote proxy server %s:%s',remoteProxyHost,remoteProxyPort));
			proxy_request.addListener('response', function (proxy_response) {
	
				proxy_response.addListener('data', function(chunk) {
					//logger.debug('Write data to client');
					if(!response.socket||response.socket.destroyed){
						   logger.error('client socket closed,oop!');
						   return response.end();
					}
					response.write(chunk, 'binary');
				});
	
				proxy_response.addListener('end', function() {
					response.end();
					logger.debug(util.format('Write data to client(%s) finish, used proxy: %s, cost: %s ms',request.socket.remoteAddress,choseProxy.join(':'),(new Date()).getTime()-startTime));
				});
				
				proxy_response.headers['remoteproxy'] = util.format('%s:%d',remoteProxyHost,remoteProxyPort)
				response.writeHead(proxy_response.statusCode, proxy_response.headers);
				//response.write(util.format('<!--%s:%d-->',remoteProxyHost,remoteProxyPort), 'binary');
				logger.debug(util.format('Remote proxy response, %d, length: %s, cost: %dms',proxy_response.statusCode,proxy_response.headers['Content-Length'],(new Date()).getTime()-timer_start));
			});

            proxy_request.addListener('timeout', function() {
                response.end();
                logger.error('Remote proxy timeout ');
            });

			proxy_request.addListener('error', function(err,socket) {
                response.end();
				logger.error('Remote proxy error: '+err);
			});
	
			request.addListener('data', function(chunk) {
				logger.debug('Transfer data to remote proxy');
				if(!proxy_request.socket||proxy_request.socket.destroyed){
					   logger.error('Remote socket closed,oop!');
					   return proxy_request.end();
				}
				proxy_request.write(chunk, 'binary');
			});
	
			request.addListener('end', function() {
				proxy_request.end();
				logger.debug('Transfer data to remote proxy finish');
			});
			
			request.addListener('close', function() {
				proxy_request.end();
				logger.error('Client closed');
			});
			
	
		});
		logger.debug(util.format('Http proxy server listen in %d',this.settings['port']));
		httpProxyServer.on('clientError',function(err,socket){
			logger.error(util.format('Client request error: %s',err));
		});
		httpProxyServer.listen(this.settings['port']);
	});	
		
}
///////////////////////////////////////////////////////////////////////////////
module.exports = proxyRouter;