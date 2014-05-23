/**
 * ssdb redis client wrapper
 * Created by cherokee on 14-5-22.
 */
var SSDB = require('./SSDB.js');

var redis_cli = function(host,port){
    this.ssdb_cli = SSDB.connect(host, port);
}

redis_cli.prototype.get = function(key,callback){
    this.ssdb_cli.get(key,callback);
}

redis_cli.prototype.set = function(key,value,callback){
    this.ssdb_cli.set(key,value,callback);
}

redis_cli.prototype.exists = function(key,callback){
    this.ssdb_cli.request('exists',[key],function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            var val = resp[1];
            callback(err, val);
        }
    });
}

redis_cli.prototype.del = function(key,callback){
    this.ssdb_cli.del(key,callback);
}

redis_cli.prototype.keys = function(key,callback){
    this.ssdb_cli.keys(key,'',-1,callback);
}

redis_cli.prototype.hlist = function(key,callback){
    this.ssdb_cli.hlist(key,'',-1,callback);
}

redis_cli.prototype.hset = function(key,attr,value,callback){
    this.ssdb_cli.hset(key,attr,value,callback);
}

redis_cli.prototype.hgetall = function(key,callback){
    this.ssdb_cli.request('hscan',[key,'','',-1],function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            var data = {};
            for(var i=1; i<resp.length-1; i+=2){
                data[resp[i].toString()] = resp[i+1].toString();
            }
            callback(err, data);
        }
    });
}

redis_cli.prototype.hmset = function(key,values,callback){
    this.ssdb_cli.request('multi_hset',[key,values],function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            callback(err);
        }
    });
}

redis_cli.prototype.hdel = function(key,attr,callback){
    this.ssdb_cli.hdel(key,attr,callback);
}

redis_cli.prototype.hclear = function(key,callback){
    this.ssdb_cli.hclear(key,function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            callback(err);
        }
    });
}

redis_cli.prototype.zlist = function(key,callback){
    this.ssdb_cli.zlist(key,'','',-1,callback);
}

redis_cli.prototype.zadd = function(name,score,key,callback){
    this.ssdb_cli.request('zset',[name,key,score],function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            callback(err);
        }
    });
}

redis_cli.prototype.zscore = function(name,key,callback){
    this.ssdb_cli.request('zget',[name,key], function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            var val = resp[1];
            callback(err, val);
        }
    });
}

redis_cli.prototype.zrem = function(name,key,callback){
    this.ssdb_cli.request('zdel',[name,key],function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            callback(err);
        }
    });
}

redis_cli.prototype.llen = function(key,callback){
    this.ssdb_cli.request('qsize',[key], function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            var val = resp[1];
            callback(err, val);
        }
    });
}

redis_cli.prototype.qlist = function(key,callback){
    this.ssdb_cli.request('qlist',[key,'','',-1],function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            var data = [];
            for(var i=1; i<resp.length; i++){
                var k = resp[i].toString();
                data.push(k);
            }
            callback(err, data);
        }
    });
}

redis_cli.prototype.lpush = function(name,key,callback){
    this.ssdb_cli.request('qpush_front',[name,key],function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            callback(err);
        }
    });
}

redis_cli.prototype.rpush = function(name,key,callback){
    this.ssdb_cli.request('qpush_back',[name,key],function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            callback(err);
        }
    });
}

redis_cli.prototype.lpop = function(name,callback){
    this.ssdb_cli.request('qpop_front',[name], function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            var val = resp[1];
            callback(err, val);
        }
    });
}

redis_cli.prototype.rpop = function(name,callback){
    this.ssdb_cli.request('qpop_back',[name], function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            var val = resp[1];
            callback(err, val);
        }
    });
}

redis_cli.prototype.lrange = function(name,start,end,callback){
    this.ssdb_cli.request('qslice',[name,start,end],function(resp){
        if(callback){
            var err = resp[0] == 'ok'? 0 : resp[0];
            var data = [];
            for(var i=1; i<resp.length; i++){
                var k = resp[i].toString();
                data.push(k);
            }
            callback(err, data);
        }
    });
}

redis_cli.prototype.close = function(){
    this.ssdb_cli.close();
}

exports.client = redis_cli;