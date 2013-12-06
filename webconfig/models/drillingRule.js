
// Drilling rule model

var redis = require('redis');
var async = require('async');
var settings = require('../../instance/webconfig/settings.json');

var client = redis.createClient(settings['driller_info_redis_db'][1],settings['driller_info_redis_db'][0]);

client.select(settings['driller_info_redis_db'][2]);

var UPDATED_TIME = "updated:driller:rule";

var drillingRule = {
	
	// get all drilling rules
	getDrillingRules: function(fn){

		var self = this;
		var keys = [];
		// retrieve all of keys that match rule*
		client.keys('driller*', function(err, keys){
			if(err){
					console.log('ERROR:', err);
				}else{
					console.log("keys : ", keys); 	

					var callFunctions = new Array();


					var rules = [];
					for(k in keys){
						callFunctions.push(self.makeCallbackFunc(keys[k]));
					}
					async.series(
						callFunctions,
						function(err, result){
							if(err) {
								console.log(err);
								return fn(err);
							}

						return fn(err, result);
					});

				}
			
		});

	},

	// get specific rule 
	makeCallbackFunc: function(member) {
		return function(callback) {
			client.hgetall(member, function(err, obj) {
				//console.log("member:", obj)
				obj['id'] = member;
				callback(err,obj);
			});
		};
	},

	// get all drilling rules
	getRulesByCondition: function(condition, fn){

		var self = this;
		var keys = [];
		var regex = 'driller:*' + condition + '*';
		// retrieve all of keys that match rule*
		client.keys(regex, function(err, keys){
			if(err){
					console.log('ERROR:', err);
				}else{
					console.log("keys : ", keys); 	

					var callFunctions = new Array();


					var rules = [];
					for(k in keys){
						callFunctions.push(self.makeCallbackFunc(keys[k]));
					}
					async.series(
						callFunctions,
						function(err, result){
							if(err) {
								console.log(err);
								return fn(err);
							}
						//console.log("succeed.", result);
						return fn(err, result);
					});

				}
			
		});

	},

	// create rule
	create: function(key, rule, fn){
		client.hmset(key, rule, function(err, result){
			if(err){
				console.log(err);
				return fn(err);
			}
			console.log("New rule ", key, " was created.");
			return fn(err, result);
		});
	},

	// show specific rule
	displayOne: function(id,fn){
		client.hgetall(id, function(err, obj){
			if(err) {
				console.log(err);
				return fn(err);
			}
			console.log("displayone:", obj);
			return fn(err, obj);
		});
	},

	// update rule
	update: function(key, rule, fn){
		client.hmset(key, rule, function(err, result){
			if(err){
				console.log(err);
				return fn(err);
			}
			client.set(UPDATED_TIME, new Date().getTime(), function(err, result){

			});
			console.log("rule ", key, " was updated.");
			return fn(err, result);
		});
	},

	// destroy a rule
	destroy: function(id, fn){
		client.del(id, function(err, obj){
			if(err) {
				console.log(err);
				return fn(err);
			}
			console.log("one rule:", id, " has been detroyed.");
			return fn(err, obj);
		});
	}

}

module.exports = drillingRule;