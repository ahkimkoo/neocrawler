
var redis = require('redis');
var lineReader = require('line-reader');
var http = require("http");
var moment = require('moment');	

PROXY_KEY1S = 'proxy:public:available:1s';
PROXY_KEY3S = 'proxy:public:available:3s';
PROXY_KEY5S = 'proxy:public:available:5s';
PROXY_KEY8S = 'proxy:public:available:8s';
PROXY_KEY12S = 'proxy:public:available:12s';
PROXY_KEY20S = 'proxy:public:available:20s';

PROXY_KEYS = [PROXY_KEY1S,PROXY_KEY3S,PROXY_KEY5S,PROXY_KEY8S,PROXY_KEY12S,PROXY_KEY20S];

var client;
var PROXYS = "hosts";

http.globalAgent.maxSockets = 100;

var proxyTester = function(settings){
	this.settings = settings;
	this.client = redis.createClient(settings['proxy_info_redis_db'][1],settings['proxy_info_redis_db'][0]);
	this.client.select(settings['proxy_info_redis_db'][2]);	

	client = this.client;

	console.log("start proxy tester.");
}

proxyTester.prototype.testProxyServer =  function(){

		var proxytester = this;
		client.spop(PROXYS, function(err,result){
				if(err){
					console.log('ERR:', err);
				}else{
					if(result != null){
												
						var ip = result.split(":")[0];
						var port = result.split(":")[1];
						console.log(ip + ":" + port);
						
						var start = new Date();
						var startDate = moment(start);		
						
						var options = {
						  hostname: ip,
						  port: port,
						  path: 'http://www.douban.com',
						  method: 'GET'
						};

						var req = http.get(options, function(res) {					  
						  
						  res.setEncoding('utf8');
						  res.on('data', function (chunk) {
							console.log('STATUS: ' + res.statusCode);
							console.log('HEADERS: ' + JSON.stringify(res.headers));
							console.log("Http request: " + ip + " " + port);						  		  
							console.log('BODY: ' + chunk);
							//
							if(chunk && (chunk.indexOf("all rights reserved") > -1 || chunk.indexOf("redirected") > -1 || res.statusCode === 200)){
								var endDate = moment(new Date());
								var secondsDiff = endDate.diff(startDate, 'seconds');
								
								var newkey = "";

								var score = 0;
								if(secondsDiff < 1){
									newkey = PROXY_KEY1S;
								}else if(secondsDiff < 3){
									newkey = PROXY_KEY3S;
								}else if(secondsDiff < 5){
									newkey = PROXY_KEY5S;
								}else if(secondsDiff < 8){
									newkey = PROXY_KEY8S;
								}else if(secondsDiff < 12){
									newkey = PROXY_KEY12S;
								}else if(secondsDiff < 20){
									newkey = PROXY_KEY20S;
								}else{
									newkey = "PROXY_UNKNOWN";
								}
								
								proxyServers = options.hostname + ":" + options.port;
								
								client.rpush(newkey, proxyServers, function(err, result){
									console.log("result:", result);
								});								
									
								console.log('Request took:', secondsDiff, 's');							
							}

						  });
	  
						}).on('error', function(e) {
						  console.log('problem with request: ' + e.message + ". " + options.hostname + ":" + options.port);
						});

					}		
				}
			});	

			setTimeout(function () {
					proxytester.testProxyServer();
				}, 5000);	
}

proxyTester.prototype.updateProxyList =  function(){

		console.log("Update proxy list");

		PROXY_KEYS.forEach(function(entry){
			client.smembers(entry + "_tmp", function(err, list){
				if(list.length > 0){

					list.forEach(function(p){
						client.rpush(entry, p, function(err, result){
							console.log("result:", result);
						});
					});					
				}
			});			
		});
}

proxyTester.prototype.process =  function(){

		console.log("Start proxy tester.");

		this.testProxyServer();
}	

/*
var schedule = require('node-schedule');
var rule = new schedule.RecurrenceRule();
rule.minute = 35;

schedule.scheduleJob(rule, function(){
    proxyDetector.process();
});
*/
////////////////////////////////////////
module.exports = proxyTester;

