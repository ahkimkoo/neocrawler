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
    .options('H', {
        'alias' : 'help',
        'describe' : 'Help infomation'
    });

var options = userArgv.argv;
if(options['H']){userArgv.showHelp();process.exit();}

var redis = require("redis");
var fs = require("fs");
var async = require('async');

var restoredb = function(db){
    var redis_cli = redis.createClient(options['p'],options['h']);
    redis_cli.select(db, function(err,result) {
        fs.readFile(options['f'],'utf8', function (err, data) {
            if (err) throw err;
            var resultArray = data.split('\n');
            for(var i=0;i<resultArray.length;i++){
                var key = resultArray[i++];
                var value = JSON.parse(resultArray[i]);
                console.log(key);
                redis_cli.hmset(key,value,function(err,status){
                    if(err)console.log(err);
                    else console.log('restore db'+db+' '+key);
                    redis_cli.quit();
                });
            }
        });
    });
}
restoredb(0);