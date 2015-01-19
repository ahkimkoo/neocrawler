
// Proxy Management model

var myredis = require('../../lib/myredis.js');
var async = require('async');
//var settings = require('../../instance/webconfig/settings.json');

var settings = global.settings;

var dbtype = 'redis';
if(settings['use_ssdb'])dbtype = 'ssdb';
var client;
myredis.createClient(
    settings['proxy_info_redis_db'][0],
    settings['proxy_info_redis_db'][1],
    settings['proxy_info_redis_db'][2],
    dbtype,
    function(err,cli){
        client = cli;
    });

// available proxy list
PROXY_P_PREFIX = 'proxy:public:available:';
PROXY_P_KEY1S = 'proxy:public:available:1s';
PROXY_P_KEY3S = 'proxy:public:available:3s';
PROXY_P_KEY5S = 'proxy:public:available:5s';
PROXY_P_KEY8S = 'proxy:public:available:8s';
PROXY_P_KEY12S = 'proxy:public:available:12s';
PROXY_P_KEY20S = 'proxy:public:available:20s';

PROXY_V_KEY1S = 'proxy:vip:available:1s';
PROXY_V_KEY3S = 'proxy:vip:available:3s';
PROXY_V_KEY8S = 'proxy:vip:available:8s';
PROXY_V_KEY15S = 'proxy:vip:available:15s';

PROXY_KEYS = [PROXY_P_KEY1S,PROXY_P_KEY3S,PROXY_P_KEY5S,PROXY_P_KEY8S,PROXY_P_KEY12S,PROXY_P_KEY20S,
			PROXY_V_KEY1S,PROXY_V_KEY3S, PROXY_V_KEY8S, PROXY_V_KEY15S, ''];

var proxyList = [];

var proxyManagement = {
	
	// get all available proxy by their response time
	getProxyList: function(fn){
		proxyList = [];

		var self = this;
		var keys = [];
		var callFunctions = new Array();

		PROXY_KEYS.forEach(function(entry){
			callFunctions.push(self.proxyByResponse(entry));
		});

		var proxy = {};
		async.series(
			callFunctions,
			function(err, result){
				if(err) {
					console.error(err);
					return fn(err);
				}
//				console.log("proxyList:", proxyList);

			return fn(err, proxyList);
		});
	},

	//
	proxyByResponse: function(member) {
		return function(callback) {
			client.lrange(member, 0, -1, function(err, obj) {
				callback(err,obj);
				
				var proxy = {};
				proxy.key = member;
				proxy.list = obj;
				obj = proxy;
				proxyList.push(proxy);
				
			});
		};
	},

	// create new proxy
	create: function(key, proxy, fn){
		client.rpush(key, proxy, function(err, result){
			if(err){
				console.error(err);
				return fn(err);
			}
//			console.log("New proxy ", key, " was created.");
			return fn(err, result);
		});
	},

	// delete proxy
	destroy: function(key, proxy, fn){
		client.lrem(key, 0, proxy, function(err, result){
			if(err){
				console.error(err);
				return fn(err);
			}
//			console.log("proxy ", key, " was deleted.");
			return fn(err, result);
		});
	}
}

module.exports = proxyManagement;