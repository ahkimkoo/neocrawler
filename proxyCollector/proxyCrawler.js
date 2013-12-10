//initial seeds list.
//http://www.youdaili.cn/Daili/http/
//http://www.youdaili.cn/Daili/guonei/
//http://www.youdaili.cn/Daili/guowai/
//http://www.cnproxy.com/
//http://www.freeproxylists.net

// step1. crawl all the web page, save link to db which match regex.
// step2. call proxy collector whenever crawled one new link.
// step3. collect all the proxy:port pair of each link.
// step4. when processed one link, call proxy tester.
// step5. separate each proxy:port and add tested proxy to redis.
// select db3

var Crawler = require("crawler").Crawler;
var redis = require('redis');
var lineReader = require('line-reader');
var settings;

//var proxyTester = require('./proxyTester.js');

var SEEDS = 'seeds';
var PROXYS = "hosts";

var client;
var crawler;

var cnproxyreg = {
		url:/http:\/\/www\.\w+\.\w+\/proxy\d+.html/,
		ip:/\d+\.\d+\.\d+\.\d+/g, 
		port:/(\+[vmalqbiwrc]){2,4}/g};
var youdailireg = {	
	url:/http:\/\/www\.\w+\.\w+.*\/\d+_?\d+?\.html/,
		ip:/\d+\.\d+\.\d+\.\d+:\d+/g};

PROXY_KEY1S = 'proxy:public:available:1s';
PROXY_KEY3S = 'proxy:public:available:3s';
PROXY_KEY5S = 'proxy:public:available:5s';
PROXY_KEY8S = 'proxy:public:available:8s';
PROXY_KEY12S = 'proxy:public:available:12s';
PROXY_KEY20S = 'proxy:public:available:20s';

PROXY_KEYS = [PROXY_KEY1S,PROXY_KEY3S,PROXY_KEY5S,PROXY_KEY8S,PROXY_KEY12S,PROXY_KEY20S];

var proxyCrawler = function(settings){
	this.settings = settings;

	crawler = new Crawler({
	      maxConnections: 1,
	      timeout: (1000 * 20)
	    });

	console.log("start proxy crawler.");
}

////////////////////////////
proxyCrawler.prototype.addLinks = function(){
	console.log('addLinks');

	// delete old hosts
	client.del(PROXYS, function(err){
		if(err){
			console.log('ERROR :', err);
		} 	
	});	
	
	// add seeds 
	lineReader.eachLine(__dirname + '/hosts.txt', function(line, last) {
		console.log(line);	

		   client.sadd(SEEDS, line, function(err){
				   if(err){
					   console.log();
				   }else {
					   console.log("Add link: ",line);
				   }
		   });	

		if(last){
			console.log('process :');
		}		
	});	
}

////////////////////////////
proxyCrawler.prototype.processSeeds = function(){
	//console.log('processSeed');

	var proxycrawler = this;

	this.client.srandmember(SEEDS, function (err, seeds){
	
	    if (err) {
	
		console.log(err);
	
	    } else {
	      	//console.log("processing :" + seeds);
			proxycrawler.processEachSeed(seeds, function (err) {			
			});
		
			proxycrawler.processSeeds();
	    }
	
	});		
}

////////////////////////////
proxyCrawler.prototype.processEachSeed = function(seeds){

	var proxycrawler = this;

	if (seeds) {
	
	    crawler.queue([{
	
		uri: seeds,
		
		callback: function(err, result, $) {
	
			  if (err) {
		
			    console.log(err);
			    return;
			  } else {
			  	console.log("uri: " + seeds);		  	  
			 
				//extract IPs from seeds
				var rawHtml = result.body.toString();
				
				var validCnproxy = seeds.match(cnproxyreg.url);
				var validYdl = seeds.match(youdailireg.url);

				if(validCnproxy){

			  	  var ipaddress = rawHtml.match(cnproxyreg.ip);

			  	  var ports = rawHtml.match(cnproxyreg.port);

			  	  if(ipaddress != null){
				  	  for(var i = 0; i < ipaddress.length;i++){
				  	  	  
				  	  	 var port = ports[i].replace(/\+/g,"").replace(/v/g,3).replace(/m/g,4).replace(/a/g,2)
				  	  	  	.replace(/l/g,9).replace(/q/g,0).replace(/b/g,5).replace(/i/g,7).replace(/w/g,6).replace(/r/g,8).replace(/c/g,1);
				  	  	  	
				  	  	  	client.sadd(PROXYS, ipaddress[i] + ":" + port, function (err){
						if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('keys :', ipaddress[i] + ":" + port);
							}
							
						});
				  	  	  
				  	  }				  	  	
			  	  }
				}
				
				if(validYdl){

			  	  var ipaddress = rawHtml.match(youdailireg.ip);

			  	  if(ipaddress != null){
				  	  for(var i = 0; i < ipaddress.length;i++){	  	  	  
				  	  	  			  
				  	  client.sadd(PROXYS, ipaddress[i], function (err){
						if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('keys :', ipaddress[i] + ":" + port);
							}
						});
				  	  }	
			  	  }
		  	  
				}

		  	   $("a").each(function(index,a) {
				
					var link = "";
									
					var rePattern_cnproxy = cnproxyreg.url;
					var rePattern_ydl = youdailireg.url;
					
					var cnproxy = a.href.match(rePattern_cnproxy);
					var ydl = a.href.match(rePattern_ydl);
					if(cnproxy){
						link= cnproxy;
					}
					if(ydl){
						link = ydl;
					}
					//update url to redis db
		 		    client.sadd(SEEDS, link, function(err, result){
					   if(err){
						   console.log();
					   }else {
					   		if (result === 1){
					   			console.log("Added links: " + SEEDS + " Link " + link);
					   			//proxycrawler.proxyTester.process(proxycrawler.settings);
					   		}  
					   }
				   });			
				
			   });				
			  }
		
			}
	
  		}]);	
    }		
}		

////////////////////////////
proxyCrawler.prototype.deleteOldProxy =  function(){

		console.log("Delete old proxy.");

		PROXY_KEYS.forEach(function(entry){
			client.del(entry, function(d){
				console.log("Delete", entry);
			});				
		});
}

////////////////////////////
proxyCrawler.prototype.launch = function(settings){
	console.log('process begin:', settings['proxy_info_redis_db'][2],settings['proxy_info_redis_db'][0],settings['proxy_info_redis_db'][1]);	
	this.settings = settings;
	this.client = redis.createClient(settings['proxy_info_redis_db'][1],settings['proxy_info_redis_db'][0]);
	this.client.select(settings['proxy_info_redis_db'][2]);	

	client = this.client;
	
	// add seeds
	this.addLinks();

	// delete old proxy
	this.deleteOldProxy();

	// process each seed
	this.processSeeds();	

	this.proxyTester = new(require('./proxyTester.js'))(this.settings);	
	
	this.proxyTester.process();
}

/*
var schedule = require('node-schedule');
var rule = new schedule.RecurrenceRule();
rule.minute = 48;

schedule.scheduleJob(rule, function(){
    proxyFounder.process();
});
*/

////////////////////////////////////////////////////////
module.exports = proxyCrawler;



