/**
 * ssdb redis client wrapper
 * Created by cherokee on 14-5-22.
 */
var SSDB = require('./SSDB.js');

var redis_cli = function(host,port){
    this.ssdb_cli = SSDB.connect(host, port);
}

redis_cli.prototype.get = function(key,callback){
    this.ssdb_cli.request('get',[key],callback);
}

redis_cli.prototype.set = function(key,value,callback){
    this.ssdb_cli.request('set',[key,value],callback);
}

redis_cli.prototype.exists = function(key,callback){
    this.ssdb_cli.request('exists',[key],callback);
}

redis_cli.prototype.del = function(key,callback){
    this.ssdb_cli.request('del',[key],callback);
}

redis_cli.prototype.keys = function(key,callback){
    this.ssdb_cli.request('keys',[key],callback);
}

redis_cli.prototype.hset = function(key,attr,value,callback){
    this.ssdb_cli.request('hset',[key,attr,value],callback);
}

redis_cli.prototype.hgetall = function(key,callback){
    this.ssdb_cli.request('hgetall',[key],callback);
}

redis_cli.prototype.hmset = function(key,values,callback){
    this.ssdb_cli.request('multi_hset',[key,values],callback);
}

redis_cli.prototype.hdel = function(key,callback){
    this.ssdb_cli.request('hdel',[key],callback);
}

redis_cli.prototype.zadd = function(name,score,key,callback){
    this.ssdb_cli.request('zset',[name,key,score],callback);
}

redis_cli.prototype.zscore = function(name,key,callback){
    this.ssdb_cli.request('zget',[name,key],callback);
}

redis_cli.prototype.zrem = function(name,key,callback){
    this.ssdb_cli.request('zdel',[name,key],callback);
}

redis_cli.prototype.llen = function(key,callback){
    this.ssdb_cli.request('qsize',[key],callback);
}

redis_cli.prototype.lpush = function(name,key,callback){
    this.ssdb_cli.request('qpush_front',[name,key],callback);
}

redis_cli.prototype.rpush = function(name,key,callback){
    this.ssdb_cli.request('qpush_back',[name,key],callback);
}

redis_cli.prototype.lpop = function(name,callback){
    this.ssdb_cli.request('qpop_front',[name],callback);
}

redis_cli.prototype.rpop = function(name,callback){
    this.ssdb_cli.request('qpop_back',[name],callback);
}

redis_cli.prototype.lrange = function(name,start,end,callback){
    this.ssdb_cli.request('qslice',[name,start,end],callback);
}

redis_cli.prototype.close = function(){
    this.ssdb_cli.close();
}

exports.client = redis_cli;