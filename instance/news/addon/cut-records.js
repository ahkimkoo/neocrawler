//demo_redis.js
//connect to redis
var redis = require('redis');
var fs = require('fs');
var async = require('async');
var JSON = require('JSON');
var client = redis.createClient('6379', '127.0.0.1');

client.on('error', function(error) {
	console.log(error);
});

client.select('1', function(error) {
	if(error) {
		console.log(error);
	} else {
		//scan
		var cursor = 0;
		var count = 0;
		async.whilst(
			function() { 
				if (count == 0) {
					return true;
				} else{
					if (cursor != 0) return true;
					else return false;
				};
			},
			function(callback) {
				client.scan(cursor, function(error, replies) {
					if (error) {
						console.log(error);
					} else {
						var keys = replies[1];
						var i = 0;
						async.whilst(
							function() {
								return i < keys.length;
							},
							function(callback2) {
								//hmget
								//key: 8fd750ca720aa2feaaa6bf0ee5af3a76
								var key = keys[i];
								client.hmget(key, 'url', 'records', function(error, replies) {
									if (error) {
										console.log(error);
									} else{
										//parse string to js array
										var rec_array = JSON.parse(replies[1]);
										console.log(rec_array);
										if(rec_array.length > 3) {
                                            var rec_array_new = rec_array.slice(-3);
											var content = key + '\r\n' + replies[1] + '\r\n' + JSON.stringify(rec_array_new) + '\r\n' + '\r\n' ;
											fs.appendFile('key_newRecords.csv', content, function(error) {
												if (error) {
													throw error;
												};
											})
											client.hset(key, 'records', JSON.stringify(rec_array_new), redis.print);
										}
										i++;
										callback2();
									};
								});
							},
							function(error) {
								if(error) {
									console.log(error);
								}
								count++;
								cursor = replies[0];
								callback();
							}
						);
					}
			
				});
			},
			function(error) {
				if (error) {
					console.log(error);
				};
				client.quit();
			} 
		);
	}
});