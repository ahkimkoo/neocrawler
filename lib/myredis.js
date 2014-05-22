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
        redis_cli.select(db, function(err,value) {
            callback(err,redis_cli);
        });
    }
}