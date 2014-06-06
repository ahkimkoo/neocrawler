/**
 * Created by cherokee on 14-6-5.
 */
var async = require('async');
var myredis = require('../lib/myredis.js');

////arguments parse///////////////////////////////////////////////////////////////
var userArgv = require('optimist')
    .usage('Usage: $0 -i [instance name] -a [pfq|psq] -h')
    .options('i', {
        'alias' : 'instance',
        'default' : 'example',
        'describe' : 'Specify a instance',
        'demand' : true
    })
    .options('a', {
        'alias' : 'action',
        'default' : 'crawl',
        'describe' : 'Specify a action,\n pfq(put fail url into url queue), \n psq(put stuck url into url queue), \n fdq(filter duplicated queue)',
        'demand' : true
    })
    .options('h', {
        'alias' : 'help',
        'describe' : 'Help infomation'
    });

var options = userArgv.argv;
if(options['h']){userArgv.showHelp();process.exit();}
var settings = require('../instance/'+options['i']+'/'+'settings.json');
var dbtype = 'redis';
if(settings['use_ssdb'])dbtype = 'ssdb';
////executable function/////////////////////////////////////////////////////////////////
var put_fail_url_into_queue = function(){
    myredis.createClient(
        settings['url_report_redis_db'][0],
        settings['url_report_redis_db'][1],
        settings['url_report_redis_db'][2],
        dbtype,
        function(err,redis_cli){
            redis_cli.zlist('fail:*',function(err,zkeys){
                if(err)throw err;
                var count = 0;
                async.whilst(
                    function(){
                        return count < zkeys.length;
                    },
                    function(callback){
                        var zkey = zkeys[count++];
                        if(zkey){
                            var urllib_key = zkey.replace('fail:','');
                            console.log('moving ',zkey);
                            redis_cli.zrange(zkey,0,(new Date()).getTime(),function(err,keylist){
                                var sub_count = 0;
                                async.whilst(
                                    function(){
                                        return sub_count < keylist.length;
                                    },
                                    function(cb){
                                        var link = keylist[sub_count++];
                                        if(link){
                                            redis_cli.rpush(urllib_key,link,function(err){
                                                if(err)console.error('Put ',urllib_key,' Error: ',err);
                                                else console.log('put ',link,' into ',urllib_key);
                                                cb(null);
                                            });
                                        }else {
                                            console.error('Invalidate url');
                                            cb(null);
                                        }
                                    },
                                    function(err){
                                        if(err)throw err;
                                        callback(err);
                                    }
                                );
                            });
                        }else {
                            console.error('Invalidate zkey');
                            callback(null);
                        }
                    },
                    function(err){
                        redis_cli.close();
                    }
                );
            });
        });
}

var put_stuck_url_into_queue = function(){
    myredis.createClient(
        settings['url_report_redis_db'][0],
        settings['url_report_redis_db'][1],
        settings['url_report_redis_db'][2],
        dbtype,
        function(err,redis_cli){
            redis_cli.zlist('stuck:*',function(err,zkeys){
                if(err)throw err;
                var count = 0;
                async.whilst(
                    function(){
                        return count < zkeys.length;
                    },
                    function(callback){
                        var zkey = zkeys[count++];
                        if(zkey){
                            var urllib_key = zkey.replace('stuck:','');
                            console.log('moving ',zkey);
                            redis_cli.zrange(zkey,0,(new Date()).getTime(),function(err,keylist){
                                var sub_count = 0;
                                async.whilst(
                                    function(){
                                        return sub_count < keylist.length;
                                    },
                                    function(cb){
                                        var link = keylist[sub_count++];
                                        if(link){
                                            redis_cli.rpush(urllib_key,link,function(err){
                                                if(err)console.error('Put ',urllib_key,' Error: ',err);
                                                else console.log('put ',link,' into ',urllib_key);
                                                cb(null);
                                            });
                                        }else {
                                            console.error('Invalidate url');
                                            cb(null);
                                        }
                                    },
                                    function(err){
                                        if(err)throw err;
                                        callback(err);
                                    }
                                );
                            });
                        }else {
                            console.error('Invalidate zkey');
                            callback(null);
                        }
                    },
                    function(err){
                        redis_cli.close();
                    }
                );
            });
        });
}

var filter_duplicated_queue = function(){
    myredis.createClient(
        settings['driller_info_redis_db'][0],
        settings['driller_info_redis_db'][1],
        settings['driller_info_redis_db'][2],
        dbtype,
        function(err,redis_cli){
            if(err)throw err;
            redis_cli.qlist('urllib:*',function(err,zkeys){
                if(err)throw err;
                var count = 0;
                async.whilst(
                    function(){
                        return count < zkeys.length;
                    },
                    function(callback){
                        var zkey = zkeys[count++];
                        var uniq_dict = {};
                        console.log('checking ',zkey);
                        if(zkey){
                            redis_cli.llen(zkey,function(err,qsize){
                                if(err){console.error(err);callback();}
                                else if(!qsize||qsize<1){
                                    console.log(zkey,' is empty');
                                    callback();
                                }else{
                                    //////////////////////////////////////
                                    var last_queue_key = false;
                                    var t_count = 0;
                                    var f_count = 0;
                                    async.doWhilst(
                                        function(cb){
                                            redis_cli.lpop(zkey,function(err,val){
                                                last_queue_key = val;
                                                t_count++;
                                                if(err){console.error(err);cb();}
                                                else{
                                                    if(val){
                                                        if(uniq_dict[val]){
                                                            console.log(zkey,' filter ',val,' ,counter: ',(++f_count),' / ',t_count);
                                                            cb();
                                                        }else{
                                                            console.log(zkey,' keep ',val,' ,counter: ',f_count,' / ',t_count);
                                                            uniq_dict[val] = true;
                                                            redis_cli.rpush(zkey,val,function(err){
                                                                if(err)console.error(err);
                                                                cb();
                                                            });
                                                        }
                                                    }else cb();
                                                }
                                            });
                                        },
                                        function(){return t_count<qsize&&last_queue_key;},
                                        function(err){
                                            callback(null);
                                        }
                                    );
                                    ////////////////////////////////////////////////////
                                }
                            });
                        }else {
                            console.error('Invalidate zkey');
                            callback(null);
                        }
                    },
                    function(err){
                        redis_cli.close();
                    }
                );
            });
        });
}

////action route/////////////////////////////////////////////////////////////////////
switch(options['a']){
    case 'pfq':
        put_fail_url_into_queue();
        break;
    case 'psq':
        put_stuck_url_into_queue();
        break;
    case 'fdq':
        filter_duplicated_queue();
        break;
    default:
        userArgv.showHelp();
}