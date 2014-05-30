/**
 * proxy router
 */
var http = require('http');
var util = require('util');
var events = require('events');
var url =  require("url");
var myredis = require('../lib/myredis.js');
require('../lib/jsextend.js');
var logger;
var CHECK_PROXY_LIST_INTERVAL = 10*60*1000;//refresh proxy list interval: 10 mins

/////////////////////////////////////////////////////////////////
var proxyRouter = function(settings){
	events.EventEmitter.call(this);//eventemitter inherits
	this.settings = settings;
	logger = settings['logger'];
    this.proxyServeMap = {};//record which browser client using which proxy ,requesting which url. e.g {'id':[url,proxy]}
    this.proxyUpdated = -1;//proxy lib updated time
    this.proxyList = [];
    this.handleCount = 0;//proxy handle count. once proxy list change, reset to 0.
}

util.inherits(proxyRouter, events.EventEmitter);//eventemitter inherits

/**
 * refresh proxy list from redis db
 * @param proxyRouter
 */
proxyRouter.prototype.refreshProxyList = function(proxyRouter){
    proxyRouter.tmp_proxyList = [];
    proxyRouter.redis_cli3.get('updated:proxy:lib',function(err,value){
        if(proxyRouter.proxyUpdated!=value){
            logger.debug(util.format('proxy changed, refresh. version: %d -> %d',proxyRouter.proxyUpdated,value));
            proxyRouter.tmp_proxyUpdated = value;
            proxyRouter.getProxyListFromDb('proxy:vip:available:1s');
        }
        else {
            logger.debug('proxy no change.');
            setTimeout(function(){proxyRouter.refreshProxyList(proxyRouter)},CHECK_PROXY_LIST_INTERVAL);//refresh again after 10 mins
        }
    });
}

/**
 * get proxy list from redisdb, emit event
 * @param label
 */
proxyRouter.prototype.getProxyListFromDb = function(label){
    var proxyRouter = this;
    proxyRouter.redis_cli3.lrange(label,0,-1,function(err,proxylist){
        if(err)throw(err);
        logger.debug(util.format('get %d proxies from :%s',proxylist.length,label));
        proxyRouter.emit('gotProxyList',label,proxylist);
    });
}
/**
 * trigger
 */
proxyRouter.prototype.start = function(){
    var proxyRouter = this;
	this.once('proxyListChanged',function (proxylist){
        this.proxyDaemon();
	});
    this.assembly();
    var dbtype = 'redis';
    if(proxyRouter.settings['use_ssdb'])dbtype = 'ssdb';

    myredis.createClient(
        proxyRouter.settings['proxy_info_redis_db'][0],
        proxyRouter.settings['proxy_info_redis_db'][1],
        proxyRouter.settings['proxy_info_redis_db'][2],
        dbtype,
        function(err,cli){
            proxyRouter.redis_cli3 = cli;
            proxyRouter.refreshProxyList(proxyRouter);
        });
}
/**
 * Choose proxy, if it request come from browser, keep a proxy for resources of page
 * @param ip
 * @param header
 * @returns {*}
 * @private
 */
proxyRouter.prototype.__chooseProxy = function(ip,header){
    var proxyRouter = this;
    this.handleCount++;
    if(header['client_pid']&&header['page']){
        var browserId = ip+':'+header['client_pid'];
        if(!this.proxyServeMap[browserId]||this.proxyServeMap[browserId][0]!==header['page']){
            //random choose
            //var choseProxy = proxyRouter.proxyList[Math.floor(Math.random() * proxyRouter.proxyList.length)];
            //fair choose
            var choseProxy = proxyRouter.proxyList[this.handleCount %  this.proxyList.length];
            this.proxyServeMap[browserId] = [header['page'],choseProxy];
            return choseProxy;
        }else {
            return this.proxyServeMap[browserId][1];
        }
    }else{
        //random choose
        //return proxyRouter.proxyList[Math.floor(Math.random() * proxyRouter.proxyList.length)];
        //fair choose
        return proxyRouter.proxyList[this.handleCount %  this.proxyList.length];
    }
}

/**
 * run proxy server daemon
 */
proxyRouter.prototype.proxyDaemon = function(){
    var proxyRouter = this;
    var httpProxyServer = http.createServer(function(request, response) {
        var startTime = (new Date()).getTime();
        logger.debug(util.format('Request %s from %s',request.url,request.socket.remoteAddress));
        //var proxy = http.createClient(80, request.headers['host']);
        //var proxy_request = proxy.request(request.method, request.url, request.headers);//202.171.253.98:80
        var choseProxy = proxyRouter.__chooseProxy(request.socket.remoteAddress,request.headers).split(':');
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

    httpProxyServer.on('error',function(err,socket){
        logger.error(util.format('Client request error: %s',err));
    });
    httpProxyServer.listen(this.settings['port']);
}

/**
 * assembly, init proxy changed listener
 */
proxyRouter.prototype.assembly = function(){
    var proxyRouter = this;
    //when refreshed proxy list, set timeout//////////////////////////////////
    this.on('refreshed_proxy_list',function(proxylist){
        this.emit('proxyListChanged',proxylist);
        this.tmp_proxyList = this.tmp_proxyList.unique().shuffle();//filter duplicated and shuffle
        this.proxyList = this.tmp_proxyList;
        this.proxyUpdated = this.tmp_proxyUpdated;
        this.handleCount = 0;//reset handle count, for proxy fair schedule
        logger.debug('proxy list changed, quantity: '+this.proxyList.length);
        setTimeout(function(){proxyRouter.refreshProxyList(proxyRouter)},CHECK_PROXY_LIST_INTERVAL);//refresh again after 10 mins
    });
    //event:gotProxyList, after getting proxy list from each redis keys
    var MIN_PROXY_LENGTH = 1000;
    proxyRouter.on('gotProxyList',function(label,proxylist){
        if(proxylist&&proxylist.length>0)proxyRouter.tmp_proxyList = proxyRouter.tmp_proxyList.concat(proxylist);
        switch(label){
            case 'proxy:vip:available:1s':
                if(proxyRouter.tmp_proxyList.length<MIN_PROXY_LENGTH)this.getProxyListFromDb('proxy:vip:available:3s');
                else {
                    proxyRouter.proxyList = proxyRouter.tmp_proxyList;
                    proxyRouter.emit('refreshed_proxy_list',proxyRouter.proxyList);
                }
                break;
            case 'proxy:vip:available:3s':
                if(proxyRouter.tmp_proxyList.length<MIN_PROXY_LENGTH)this.getProxyListFromDb('proxy:public:available:1s');
                else {
                    proxyRouter.proxyList = proxyRouter.tmp_proxyList;
                    proxyRouter.emit('refreshed_proxy_list',proxyRouter.proxyList);
                }
                break;
            case 'proxy:public:available:1s':
                if(proxyRouter.tmp_proxyList.length<MIN_PROXY_LENGTH)this.getProxyListFromDb('proxy:public:available:3s');
                else {
                    proxyRouter.proxyList = proxyRouter.tmp_proxyList;
                    proxyRouter.emit('refreshed_proxy_list',proxyRouter.proxyList);
                }
                break;
            case 'proxy:public:available:3s':
                if(proxyRouter.tmp_proxyList.length<MIN_PROXY_LENGTH)logger.warn(util.format('Only %d proxies !!!',proxyRouter.tmp_proxyList.length));
                if(proxyRouter.tmp_proxyList.length<=0)throw new Error('no proxy list');
                else{
                    proxyRouter.proxyList = proxyRouter.tmp_proxyList;
                    proxyRouter.emit('refreshed_proxy_list',proxyRouter.proxyList);
                }
                break;
        }
    });
}
///////////////////////////////////////////////////////////////////////////////
module.exports = proxyRouter;