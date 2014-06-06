/**
 * redis instance
 * Created by cherokee on 14-5-22.
 */

var redis = require("redis");
var ssdb = require("./ssdb_redis.js");

exports.createClient = function(host,port,db,type,callback){
    if(type=='ssdb'){
        var ssdb_cli = ssdb.client(host,port);
        callback(null,ssdb_cli);
    }else{
        var redis_cli = redis.createClient(port,host);
        redis_cli.hlist = function(name,callback){
            redis_cli.keys(name,callback);
        };
        redis_cli.hclear = function(name,callback){
            redis_cli.del(name,callback);
        };
        redis_cli.zlen = function(name,callback){
            redis_cli.zcount(name,0,(new Date()).getTime(),callback);
        };
        redis_cli.zlist = function(name,callback){
            redis_cli.keys(name,callback);
        };
        redis_cli.qlist = function(name,callback){
            redis_cli.keys(name,callback);
        };
        redis_cli.select(db, function(err,value) {
            callback(err,redis_cli);
        });
    }
}

/*
exports.createClient('10.1.1.122',1788,0,'ssdb',function(err,c){
    c.hlist('driller',function(err,values){
        console.log(err);
        console.log(values);
        //c.close();
    });
});
*/