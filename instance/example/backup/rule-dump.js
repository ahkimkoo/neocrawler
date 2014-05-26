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
    .options('H', {
        'alias' : 'help',
        'describe' : 'Help infomation'
    });

var options = userArgv.argv;
if(options['H']){userArgv.showHelp();process.exit();}

var redis = require("redis");
var fs = require("fs");
var async = require('async');

var dumpdb = function(db){
    var redis_cli = redis.createClient(options['p'],options['h']);
    redis_cli.select(db, function(err,result) {
        redis_cli.hlist('driller:*',function(err,keyList){
            for(var i=0;i<keyList.length;i++){}
            var count = 0;
            var resultArray = [];
            async.whilst(
                function () { return count < keyList.length; },
                function (callback) {
                    console.log('dump db'+db+' '+keyList[count]);
                    redis_cli.hgetall(keyList[count],function(err,value){
                        if(err){console.log(err);callback(err);}
                        resultArray.push(keyList[count]);
                        resultArray.push(JSON.stringify(value));
                        count++;
                        callback();
                    });
                },
                function(err) {
                    if(err){
                        console.log('dump db'+db+' failure.'+err);
                        redis_cli.quit();
                    }else{
                        fs.writeFile(options['f'], resultArray.join('\n'),'utf8', function (err) {
                            if(err) throw err;
                            console.log('dump '+options['h']+':'+options['p']+' db'+db+' to '+options['f']);
                            redis_cli.quit();
                        });
                    }

                }
            );
        });
    });
}
dumpdb(0);