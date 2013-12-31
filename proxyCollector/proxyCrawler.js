//initial seeds list.
//http://www.youdaili.cn/Daili/http/
//http://www.youdaili.cn/Daili/guonei/
//http://www.youdaili.cn/Daili/guowai/
//http://www.cnproxy.com/
//http://www.cnproxy.com/proxy1.html
//http://proxy.ipcn.org/proxylist.html
//http://www.cybersyndrome.net/search.cgi?q=CN
//http://www.ip-adress.com/proxy_list/
//http://www.proxyswitcheroo.com/proxies.html
//http://old.cool-proxy.net/index.php?action=proxy-list
//http://www.proxy360.cn/default.aspx
//http://www.xroxy.com/proxylist.php?port=&type=All_http&country=CN
//http://gatherproxy.com/proxylist/country/?c=China
//http://www.proxynova.com/proxy-server-list/country-cn/
//http://free-proxy-list.net/
//http://www.freeproxylists.net/
//http://www.freeproxylists.net/?page=2

//Web Scraping in Node.js
//http://www.sitepoint.com/web-scraping-in-node-js/
//url:/^(?!:\/\/)([a-zA-Z0-9]+\.)?[a-zA-Z0-9][a-zA-Z0-9-]+\.[a-zA-Z]{2,6}?$/,

// step1. crawl all the web page, save link to db which match regex.
// step2. call proxy collector whenever crawled one new link.
// step3. collect all the proxy:port pair of each link.
// step4. when processed one link, call proxy tester.
// step5. separate each proxy:port and add tested proxy to redis.
// select 3 from redis-cli db

var Crawler = require("crawler").Crawler;
var redis = require('redis');
var lineReader = require('line-reader');
var settings;

//var proxyTester = require('./proxyTester.js');

var SEEDS = 'seeds';
var PROXYS = "hosts";

var client = null;
var crawler = null;

var proxycybersyndromereg = {	
	url:/http:\/\/www\.\cybersyndrome\.\net\/\w+/,
		ip:/\d+\.\d+\.\d+\.\d+:\d+/g};
var proxyipcnreg = {	
	url:/http:\/\/proxy\.\ipcn\.\net\/\w+/,
		ip:/\d+\.\d+\.\d+\.\d+:\d+/g};
var proxyipadressreg = {	
	url:/http:\/\/www\.\ip-adress\.\com\/\w+/,
		ip:/\d+\.\d+\.\d+\.\d+:\d+/g};
var proxyoldcoolproxynetreg = {	
	url:/http:\/\/old\.\w+\.\w+.*\/\w+/,
		ip:/\d+\.\d+\.\d+\.\d+:\d+/g};
var proxyswitcherooreg = {	
	url:/http:\/\/www\.\proxyswitcheroo\.\com\/\d+?\.html/,
		ip:/\d+\.\d+\.\d+\.\d+:\d+/g};
var proxy360reg = {
		url:/http:\/\/www\.\proxy360\.\cn/,
		ip:/\d+\.\d+\.\d+\.\d+/g,
		port:/(80)?(80){2,4}/g};
var xroxyreg = {
		url:/http:\/\/www\.\xroxy\.\w+/,
		ip:/\d+\.\d+\.\d+\.\d+/g,
		port:/(80)?(80){2,4}/g};
var free_proxy_listreg = {
		url:/^(?!:\/\/)([a-zA-Z0-9]+\.)?\free-proxy-list\.net/,
		ip:/\d+\.\d+\.\d+\.\d+/g,
		port:/(80)?(80){2,4}(8000|3128)/g};
var gatherproxyreg = {	
		url:/http:\/\/gatherproxy\.\com\/proxylist\/country\/\?c=China/,
		ip:/\d+\.\d+\.\d+\.\d+/g,
		port:/(\(80)?(80){2,4}/g};
var proxynovareg = {	
		url:/http:\/\/www\.\proxynova\.\w+/,
		ip:/\d+\.\d+\.\d+\.\d+/g,
		port:/(\(80)?(80){2,4}/g};
var freeproxylistsreg = {	
		url:/http:\/\/www\.\w+\.\w+/,
		ip:/\d+\.\d+\.\d+\.\d+/g,
		port:/(\(80)?(80){2,4}/g};
var cnproxyreg = {
		url:/http:\/\/www\.\cnproxy\.\w+\/proxy\d+.html/,
		ip:/\d+\.\d+\.\d+\.\d+/g, 
		port:/(\+[vmalqbiwrc]){2,4}/g};
var youdailireg = {	
	url:/http:\/\/www\.\youdaili\.\cn\/\d+_?\d+?\.html/,
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
		//console.log(line);
		client.sadd(SEEDS, line, function(err){
				   if(err){
					   console.log();
				   }else {
					   console.log("Add link in addLinks: ",line);
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
				var rawHtml = null;
				rawHtml = result.body.toString();

				var validproxycybersyndrome = seeds.match(proxycybersyndromereg.url);

				var validproxyipcn = seeds.match(proxyipcnreg.url);

				var validproxyipadress = seeds.match(proxyipadressreg.url);

				var validoldcoolproxynet = seeds.match(proxyoldcoolproxynetreg.url);

				var validproxyswitcheroo = seeds.match(proxyswitcherooreg.url);

				var validproxy360 = seeds.match(proxy360reg.url);

				var validCnproxy = seeds.match(cnproxyreg.url);

				var validYdl = seeds.match(youdailireg.url);
				
				if(seeds.indexOf("http://www.cybersyndrome.net/search.cgi?q=CN") != -1)
				{
					validproxycybersyndrome = true;
					//console.log("TRUE: " + seeds);
				}

				if(seeds.indexOf("http://proxy.ipcn.org/proxylist.html") != -1)
				{
					validproxyipcn = true;
					//console.log("TRUE: " + seeds);
				}

				if(seeds.indexOf("http://www.ip-adress.com/proxy_list/") != -1)
				{
					validproxyipadress = true;

					console.log("TRUE: " + seeds);
				}


				if(seeds.indexOf("http://old.cool-proxy.net/index.php") != -1)
				{
					validoldcoolproxynet = true;
					//console.log("TRUE: " + seeds);
				}

				if(seeds.indexOf("http://www.proxyswitcheroo.com/proxies.html") != -1)
				{
					validproxyswitcheroo = true;
					//console.log("TRUE: " + seeds);
				}

				if(seeds.indexOf("www.proxy360.cn/default.aspx") != -1)
				{
					validproxy360 = true;
					//console.log("TRUE: " + seeds);
				}

				var validxroxy = false;
				
				if(seeds.indexOf("http://www.xroxy.com/proxylist.php?port=&type=All_http&country=CN") != -1)
				{
					validxroxy = true;
					//console.log("TRUE: " + seeds);
				}

				var validfree_proxy_list = false;//seeds.match(free_proxy_listreg.url);

				if(seeds.indexOf("http://free-proxy-list.net") != -1)
				{
					validfree_proxy_list = true;
				}

				var validgatherproxy = false; //seeds.match(gatherproxyreg.url);
				
				if(seeds.indexOf("http://gatherproxy.com/proxylist/country/?c=China") != -1)
				{
					validgatherproxy = true;
					//console.log("TRUE: " + seeds);
				}

				var validproxynova = false; //seeds.match(proxynovareg.url);

				if(seeds.indexOf("http://www.proxynova.com/proxy-server-list/country-cn/") != -1)
				{
					validproxynova = true;
					//console.log("TRUE: " + seeds);
				}

				var validfreeproxylists = false; //seeds.match(freeproxylistsreg.url);

				if(seeds.indexOf("http://www.freeproxylists.net/") != -1)
				{
					validfreeproxylists = true;
					//console.log("TRUE: " + seeds);
				}

				//console.log("extract IPs from seeds: " + validYdl);

				if(validproxycybersyndrome){

			  	  var ipaddressproxycybersyndrome = rawHtml.match(proxycybersyndromereg.ip);

				  //console.log("ipaddress: " + ipaddressproxycybersyndrome);

			  	  if(ipaddressproxycybersyndrome != null){
					  
				  	  for(var i = 0; i < ipaddressproxycybersyndrome.length;i++){
					  ipandportipaddressproxycybersyndrome = ipaddressproxycybersyndrome[i];
				  	  //console.log("TEST ipaddress", ipaddressYdl[i]);			  
				  	  client.sadd(PROXYS,ipandportipaddressproxycybersyndrome, function (err){
						if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('TEST keys :', ipaddressoldcoolproxynet[i] + ":" + port);
							}
						});
				  	  }	
			  	  }
		  	  
				}

				if(validproxyipcn){

			  	  var ipaddressproxyipcn = rawHtml.match(proxyipcnreg.ip);

				  //console.log("ipaddress: " + ipaddressproxyipcn);

			  	  if(ipaddressproxyipcn != null){
					  
				  	  for(var i = 0; i < ipaddressproxyipcn.length;i++){
					  ipandportproxyipcn = ipaddressproxyipcn[i];	  	  	  
				  	  //console.log("TEST ipaddress", ipaddressYdl[i]);			  
				  	  client.sadd(PROXYS,ipandportproxyipcn, function (err){
						if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('TEST keys :', ipaddressoldcoolproxynet[i] + ":" + port);
							}
						});
				  	  }	
			  	  }
		  	  
				}

				if(validproxyipadress){

			  	  var ipaddressproxyipadress = rawHtml.match(proxyipadressreg.ip);

				  //console.log("ipaddress: " + ipaddressproxyipadress);

			  	  if(ipaddressproxyipadress != null){
				  	  for(var i = 0; i < ipaddressproxyipadress.length;i++){
					  ipandportproxyipadress = ipaddressproxyipadress[i];	  	  	  	  
				  	  	  //console.log("TEST ipaddress", ipaddressYdl[i]);			  
				  	  client.sadd(PROXYS,ipandportproxyipadress, function (err){
						if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('TEST keys :', ipaddressoldcoolproxynet[i] + ":" + port);
							}
						});
				  	  }	
			  	  }
		  	  
				}

				if(validoldcoolproxynet){

			  	  var ipaddressoldcoolproxynet = rawHtml.match(proxyoldcoolproxynetreg.ip);

				  //console.log("ipaddress: " + ipaddressoldcoolproxynet);

			  	  if(ipaddressoldcoolproxynet != null){
				  	  for(var i = 0; i < ipaddressoldcoolproxynet.length;i++){
					  ipandportoldcoolproxynet = ipaddressoldcoolproxynet[i];		  	 
				  	  	  //console.log("TEST ipaddress", ipaddressYdl[i]);			  
				  	  client.sadd(PROXYS, ipandportoldcoolproxynet, function (err){
						if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('TEST keys :', ipaddressoldcoolproxynet[i] + ":" + port);
							}
						});
				  	  }	
			  	  }
		  	  
				}

				if(validproxyswitcheroo){

			  	  var ipaddressproxyswitcheroo = rawHtml.match(proxyswitcherooreg.ip);

				  //var portsproxyswitcheroo = rawHtml.match(proxyswitcherooreg.port);

				  //console.log("ipaddress: " + ipaddressproxyswitcheroo);

			  	  if(ipaddressproxyswitcheroo != null){
					  
				  	  for(var i = 0; i < ipaddressproxyswitcheroo.length;i++){
						ipandportproxyswitcheroo = ipaddressproxyswitcheroo[i];	  	  	  
				  	  	  //console.log("TEST ipaddress", ipaddressYdl[i]);			  
				  	  client.sadd(PROXYS, ipandportproxyswitcheroo, function (err){
						if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('TEST keys :', ipaddress[i] + ":" + port);
							}
						});
				  	  }	
			  	  }
		  	  
				}

				if(validproxy360){

				  //console.log("TEST" + validproxy360);
			  	  
				  var ipaddressproxy360 = rawHtml.match(proxy360reg.ip);

				  //var ports = [80,8080,8000,3128];

			  	  var portsproxy360 = rawHtml.match(proxy360reg.port);

			  	  if(ipaddressproxy360 != null) {
				      for(var i = 0; i < ipaddressproxy360.length;i++){	  	  	  
				  	  //console.log("TEST ipaddress: ", ipaddressproxy360[i]);	
					  ipandportproxy360 = ipaddressproxy360[i] + ":" + portsproxy360[i];
					  client.sadd(PROXYS, ipandportproxy360, function (err){	
						if(err){
							console.log('ERROR a:', err);
						} else {
							//console.log('TEST keys :', ipaddressadd);
							}
						});
				      } //for
					
			  	  } //if not null 
		  	  
				} //if valid


				if(validxroxy){

				  //console.log("TEST: " + validxroxy);

			  	  var ipaddressxroxy = rawHtml.match(xroxyreg.ip);

			  	  var portsxroxy = rawHtml.match(xroxyreg.port);

			  	  if(ipaddressxroxy != null){
				  	for(var i = 0; i < ipaddressxroxy.length;i++){
				  	  	  
				  	  	//var portxroxy = ports[i];
				  	  	
						ipandportxroxy  = ipaddressxroxy[i] + ":" + portsxroxy[i];
				  	  	client.sadd(PROXYS, ipandportxroxy, function (err){
							if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('keys :', ipaddress[i] + ":" + port);
							}

						});
  
				  	  }				  	  	
			  	     }
				}


				if(validfree_proxy_list){

				  //console.log("TEST: " + validfree_proxy_list);

			  	  var ipaddressfree_proxy_list = rawHtml.match(free_proxy_listreg.ip);

				  //console.log("ipaddress: " + ipaddress);

			  	  var portsfree_proxy_list = rawHtml.match(free_proxy_listreg.port);

				  //console.log("ports: " + ports);

			  	  if(ipaddressfree_proxy_list != null && portsfree_proxy_list != null){
				  	  for(var i = 0; i < ipaddressfree_proxy_list.length;i++){
				  	  	  
				  	  	//var port2 = ports2[i];
				  ipandportfree_proxy_list  = ipaddressfree_proxy_list[i] + ":" + portsfree_proxy_list[i];
				  	  	client.sadd(PROXYS, ipandportfree_proxy_list, function (err){
							if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('keys :', ipaddress[i] + ":" + port);
							}
							
						});  
				  	  }				  	  	
			  	     }
				}

				if(validgatherproxy){

			  	  var ipaddressgatherproxy = rawHtml.match(gatherproxyreg.ip);

			  	  var portsgatherproxy = rawHtml.match(gatherproxyreg.port);

			  	  if(ipaddressgatherproxy != null && portsgatherproxy != null){

					  //console.log("ipaddress: " + ipaddress);

				  	  for(var i = 0; i < ipaddressgatherproxy.length;i++){
				  	  	  
				  	  	//var port = ports[i];
				  	  	ipandportgatherproxy = ipaddressgatherproxy[i] + ":" + portsgatherproxy[i];
				  	  	client.sadd(PROXYS, ipandportgatherproxy, function (err){
							if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('keys :', ipaddress[i] + ":" + port);
							}
							
						});
				  	  	  
				  	  }				  	  	
			  	  }
				}

				if(validproxynova){

			  	  var ipaddressproxynova = rawHtml.match(proxynovareg.ip);

			  	  var portsproxynova = rawHtml.match(proxynovareg.port);

			  	  if(ipaddressproxynova != null && portsproxynova != null){
				  	  for(var i = 0; i < ipaddressproxynova.length;i++){
				  	  	  
				  	  	 var portproxynova = portsproxynova[i];
				  	  	  	
				  	  	  	client.sadd(PROXYS, ipaddressproxynova[i] + ":" + portproxynova, function (err){
						if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('keys :', ipaddress[i] + ":" + port);
							}
							
						});
				  	  	  
				  	  }				  	  	
			  	  }
				}

				if(validfreeproxylists){

			  	  var ipaddressfreeproxylists = rawHtml.match(freeproxylistsreg.ip);

			  	  var portsfreeproxylists = rawHtml.match(freeproxylistsreg.port);

 				  //console.log("ports: " + ports);

			  	  if(ipaddressfreeproxylists != null){
				  	  for(var i = 0; i < ipaddressfreeproxylists.length;i++){

					  //console.log("Port from seeds: " + ports[i]);
				  	  	  
				  	  	var portfreeproxylists = ports[i];
				  	  	  	
						//console.log("extract Port from seeds: " + port);

				  	  	client.sadd(PROXYS, ipaddressfreeproxylists[i] + ":" + portfreeproxylists, function (err){
							if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('keys :', ipaddressfreeproxylists[i] + ":" + portfreeproxylists);
							}
							
						});
				  	  	  
				  	  }				  	  	
			  	      }
				}

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

			  	  var ipaddressYdl = rawHtml.match(youdailireg.ip);

				  //console.log("ipaddress: " + ipaddress);

			  	  if(ipaddressYdl != null){
				  	  for(var i = 0; i < ipaddressYdl.length;i++){	  	  	  
				  	  	  //console.log("TEST ipaddress", ipaddressYdl[i]);			  
				  	  client.sadd(PROXYS, ipaddressYdl[i], function (err){
						if(err){
								console.log('ERROR a:', err);
							} else {
								//console.log('TEST keys :', ipaddress[i] + ":" + port);
							}
						});
				  	  }	
			  	  }
		  	  
				}

			   if(validCnproxy || validYdl || validfreeproxylists){
		  	      $("a").each(function(index,a) {

					//console.log('TEST a: ' + a);

					var link = "";

					var rePattern_freeproxylists = freeproxylistsreg.url;
					var rePattern_cnproxy = cnproxyreg.url;
					var rePattern_ydl = youdailireg.url;

					var freeproxylists = a.href.match(rePattern_freeproxylists);
					var cnproxy = a.href.match(rePattern_cnproxy);
					var ydl = a.href.match(rePattern_ydl);

					if(freeproxylists){
					   link= freeproxylists;
					}
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
					   			console.log("Added links for: " + SEEDS + " Link " + link);
					   			//proxycrawler.proxyTester.process(proxycrawler.settings);
					   		}  
					   }
				   });			
				
			   });	
			} //if not validproxy360			
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

	// delete old proxy once if running each proxy in hosts one by one
	//this.deleteOldProxy();

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



