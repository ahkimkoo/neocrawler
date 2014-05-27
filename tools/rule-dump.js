/**
 * Created by James on 14-2-27.
 * redis helper: dump to file, and restore from file
 */

var userArgv = require('optimist')
    .usage('Usage: $0 -h [host name] -p [port]  -f [file prefix] -h')
    .options('h', {
        'alias' : 'host',
        'default' : 'localhost',
        'describe' : 'Specify redis hostname, e.g: localhost',
        'demand' : true
    })
    .options('p', {
        'alias' : 'port',
        'default' : 6379,
        'describe' : 'Specify redis port, e.g: 6379',
        'demand' : true
    })
    .options('f', {
        'alias' : 'file',
        'default' : 'dump',
        'describe' : 'Specify a file name'
    })
    .options('t', {
        'alias' : 'type',
        'default' : 'redis',
        'describe' : 'Specify a DBtype: redis/ssdb'
    })
    .options('d', {
        'alias' : 'db',
        'default' : '0',
        'describe' : 'Specify a db'
    })
    .options('q', {
        'alias' : 'query',
        'default' : 'driller:*',
        'describe' : 'Specify a query string, e.g:driller:*'
    })
    .options('H', {
        'alias' : 'help',
        'describe' : 'Help infomation'
    });

var options = userArgv.argv;
if(options['H']){userArgv.showHelp();process.exit();}

var redis = require("../lib/myredis.js");
var fs = require("fs");
var async = require('async');

var dumpdb = function(db){
    redis.createClient(options['h'],options['p'],db,options['t'],function(err,redis_cli)
        {
                redis_cli.hlist(options['q'],function(err,keyList){
                    for(var i=0;i<keyList.length;i++){}
                    var count = 0;
                    if(fs.existsSync(options['f']))fs.unlinkSync(options['f']);
                    async.whilst(
                        function () { return count < keyList.length; },
                        function (callback) {
                            var key = keyList[count];
                            console.log('dump db'+db+' '+key);
                            redis_cli.hgetall(key,function(err,value){
                                if(err){console.log(err);callback(err);}
                                count++;
                                fs.appendFile(options['f'], key+'\n'+JSON.stringify(value)+'\n',{'encoding':'utf8'},function(err){
                                    if (err) throw err;
                                    else callback();
                                });
                            });
                        },
                        function(err) {
                            if(err){
                                console.log('dump db'+db+' failure.'+err);
                            }else{
                                console.log('dump '+options['h']+':'+options['p']+' db'+db+' to '+options['f']);
                            }
                            redis_cli.quit();
                        }
                    );
                });
        }
    );
}
dumpdb(parseInt(options['d']));