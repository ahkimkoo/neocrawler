/**
 * Created by cherokee on 14-6-16.
 */
var async = require('async');
var httpRequest = require('../../../lib/httpRequest.js');
var myredis = require('../../../lib/myredis.js');
var settings = require('../settings.json');
require('../../../lib/jsextend.js');

var trim_proxy_lib  = function(){
    var dbtype = 'redis';
    if(settings['use_ssdb'])dbtype = 'ssdb';
    var max_quantity = 1000;
    myredis.createClient(
        settings['proxy_info_redis_db'][0],
        settings['proxy_info_redis_db'][1],
        settings['proxy_info_redis_db'][2],
        dbtype,
        function(err,redis_cli){
            if(err)throw err;
            redis_cli.llen('proxy:public:available:3s',function(err,value){
                if(err)throw err;
                var quantity = parseInt(value);
                if(quantity>max_quantity){
                    async.whilst(
                        function(){
                            return quantity>max_quantity;
                        },
                        function(callback){
                            redis_cli.rpop('proxy:public:available:3s',function(err,value){
                                    redis_cli.llen('proxy:public:available:3s',function(err,value){
                                        if(!err&&value)quantity = parseInt(value);
                                        console.log('trim proxy lib, length: '+quantity);
                                        callback();
                                    });
                            });
                        },
                        function(err){
                            console.log('trim finish, length: '+quantity);
                            if(dbtype=='ssdb')redis_cli.close();
                        }
                    );
                }
            });
        });
}


var check_56pu = function(testurl,keywords){
    var dbtype = 'redis';
    if(settings['use_ssdb'])dbtype = 'ssdb';
    var max_quantity = 1000;
    var api_addr = 'http://www.56pu.com/api?orderId=697468190602519&quantity=300&line=all&region=&regionEx=&beginWith=&ports=&vport=&speed=&anonymity=3&scheme=&duplicate=2&sarea=';
    var echo_server_addr = 'http://echo.weishuju.cn/';//echo server:http://61.155.182.29:1337/

    myredis.createClient(
        settings['proxy_info_redis_db'][0],
        settings['proxy_info_redis_db'][1],
        settings['proxy_info_redis_db'][2],
        dbtype,
        function(err,redis_cli){
            if(err){
                console.error('connect to redis error: '+err);
                setTimeout(function(){
                    check_56pu(testurl,keywords);
                },30000);
            }else{
                redis_cli.llen('proxy:public:available:3s',function(err,value){
                    if(err){
                        console.error('access redis error: '+err);
                        setTimeout(function(){
                            check_56pu(testurl,keywords);
                        },30000);
                    }else{
                        if(parseInt(value)>max_quantity){
                            console.log('There are '+value+' in proxy:public:available:3s,trim it');
                            trim_proxy_lib();
                        }
                        //----------------------------
                        httpRequest.request(echo_server_addr,null,null,null,30,false,function(err,status_code,content,page_encoding){
                            if(err){
                                console.error('request echo server error: '+err);
                                setTimeout(function(){
                                    check_56pu(testurl,keywords);
                                },30000);
                            }else{
                                var content_json = JSON.parse(content);
                                var myip = content_json['IP'];
                                console.log('My ip is: '+myip);
                                ///////////////////////////////////////////////////////
                                httpRequest.request(api_addr,null,null,null,300,false,function(err,status_code,content,page_encoding){
                                    if(err){
                                        console.error('request proxy api error: '+err);
                                        setTimeout(function(){
                                            check_56pu(testurl,keywords);
                                        },30000);
                                    }else{
                                        var ip_arr = content.split('\r\n');
                                        var av_count = 0;
                                        var checkingQueue = async.queue(function(proxy, qcallback) {
                                            console.log('checking proxy: '+proxy);
                                            httpRequest.request(echo_server_addr,null,null,proxy,60,false,function(err,status_code,content,page_encoding){
                                                if(err||parseInt(status_code)!=200){
                                                    console.error('Request '+echo_server_addr+' error using proxy: '+proxy+', status code: '+status_code+', Error: '+err);
                                                    try{qcallback();}catch(e){console.error('Fucking error: '+e);}
                                                }else{
                                                    if(content.startsWith('{')){
                                                        try{
                                                            var info = JSON.parse(content);
                                                        }catch(e){
                                                            console.error('proxy checker: json parse error: '+proxy);
                                                            return qcallback();
                                                        };

                                                        var available_proxy = true;
                                                        if(!info['IP']||!info['HEADERS'])available_proxy = false;
                                                        if(info['HEADERS']){
                                                            if(info['HEADERS']['REMOTE_ADDR']&&info['HEADERS']['REMOTE_ADDR']==myip)available_proxy = false;
                                                            if(info['HEADERS']['X-REAL-IP']&&info['HEADERS']['X-REAL-IP']==myip)available_proxy = false;
                                                            //strict mode
                                                            //if(info['HEADERS']['HTTP_VIA'])available_proxy = false;
                                                            //if(info['HEADERS']['HTTP_X_FORWARDED_FOR'])available_proxy = false;
                                                            //if(info['HEADERS']['X-FORWARDED-FOR'])available_proxy = false;
                                                            //if(info['HEADERS']['X-REAL-IP'])available_proxy = false;
                                                            if(info['HEADERS']['HTTP_X_FORWARDED_FOR']&&info['HEADERS']['HTTP_X_FORWARDED_FOR'].indexOf(myip)>0)available_proxy = false;
                                                            if(info['HEADERS']['X-FORWARDED-FOR']&&info['HEADERS']['X-FORWARDED-FOR'].indexOf(myip)>0)available_proxy = false;
                                                        }

                                                        if(available_proxy){
                                                            if(testurl){
                                                                httpRequest.request(testurl,null,null,proxy,120,false,function(err,status_code,content,page_encoding){
                                                                    if(err||parseInt(status_code)!=200){
                                                                        console.error('Request '+testurl+'error using proxy: '+proxy+', status code: '+status_code+', Error: '+err);
                                                                        qcallback();
                                                                    }else{
                                                                        if(keywords){
                                                                            available_proxy = content.indexOf(keywords)>0;
                                                                        }
                                                                        if(available_proxy){
                                                                            redis_cli.lpush('proxy:public:available:3s',proxy,function(err,value){
                                                                                if(!err){
                                                                                    console.log('proxy checker: Append a available proxy: '+proxy);
                                                                                    av_count++;
                                                                                }
                                                                                qcallback();
                                                                            });
                                                                        }else{
                                                                            console.error('Request '+testurl+'error using proxy: '+proxy+', keywords lacks of: '+keywords);
                                                                            qcallback();
                                                                        }
                                                                    }
                                                                });
                                                            }else{
                                                                redis_cli.lpush('proxy:public:available:3s',proxy,function(err,value){
                                                                    if(!err){
                                                                        console.log('proxy checker: Append a available proxy: '+proxy);
                                                                        av_count++;
                                                                    }
                                                                    qcallback();
                                                                });
                                                            }

                                                        }else {
                                                            console.warn('proxy checker: ' +proxy + ' is invalidate proxy!');
                                                            qcallback();
                                                        }
                                                    }else {console.error('proxy checker: ' +proxy + ' is unavailable!');qcallback();}
                                                }
                                            });
                                        }, 20);

                                        checkingQueue.drain = function() {
                                            console.log('check proxy complete, available: '+av_count+'/'+ip_arr.length+', ratio: '+(av_count/(ip_arr.length*1.0)));
                                            if(dbtype=='ssdb')redis_cli.close();
                                            setTimeout(function(){
                                                check_56pu(testurl,keywords);
                                            },30000);
                                            console.log('sleep 30s...');
                                            //process.exit(0);
                                        }

                                        for(var i = 0;i<ip_arr.length;i++){
                                            checkingQueue.push(ip_arr[i]);
                                        }
                                    }
                                });
                                //////////////////////////////////////////////////////
                            }
                        });
                        //----------------------------
                    }
                });
            }
        });
}

check_56pu(process.argv.length>2?process.argv[2]:null,process.argv.length>3?process.argv[3]:null);

