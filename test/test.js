/**
 * test
 */
var redis = require("redis");
var fs = require("fs");

fs.readFile('proxy.txt','utf-8', function (err, data) {
	  if (err) throw err;
	  var proxylist = data.split("\n");
	  
	  var redis = require("redis");
	  client = redis.createClient(6379,'127.0.0.1');
	  client.select(3, function() {
		  for(x in proxylist){
			  if(proxylist[x]!=='')client.rpush('proxy:public:available:3s',proxylist[x]);
			  console.log('rpush '+proxylist[x]);
		  }
		  client.quit();
	  });
	  
	});