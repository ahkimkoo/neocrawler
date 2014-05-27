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
        'describe' : 'Specify a file name , do not include suffix'
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
    .options('H', {
        'alias' : 'help',
        'describe' : 'Help infomation'
    });

var options = userArgv.argv;
if(options['H']){userArgv.showHelp();process.exit();}

var redis = require("../lib/myredis.js");
var fs = require("fs");
var lineReader = require('../lib/line_reader.js');

var restoredb = function(db){
    redis.createClient(options['h'],options['p'],db,options['t'],function(err,redis_cli)
    {
        if(err)throw err;
        var count = 0;
        var key,value;
        lineReader.eachLine(options['f'], function(line, last,cb) {
            if(count++%2==0){
                key = line;
                if(last){
                    redis_cli.quit();
                    cb(false);
                }else cb();
            }else {
                value = JSON.parse(line);
                redis_cli.hmset(key,value,function(err,status){
                    if(err)console.log(err);
                    else console.log('restore db'+db+' '+key+' status:'+status);
                    if(last){
                        redis_cli.quit();
                        cb(false);
                    }else cb();
                });
            }
        });
    });
}
restoredb(parseInt(options['d']));