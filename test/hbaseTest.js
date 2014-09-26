/**
 * Created by cherokee on 14-4-18.
 */
require('../lib/jsextend.js');

var testOldAPI = function(callback){
    var hbase = require('hbase');
    var fs = require('fs');
    var path = require('path');

    var hbase_cli = hbase({
        host:'snow',
        port:8080
    });

    var hbase_table = hbase_cli.getTable('crawled_bin');

    var row = hbase_table.getRow('image'+(new Date()).getTime());

    fs.readFile('Chinese.png', function (err, data) {
        if (err) throw err;
        var btime = new Date();
//    console.log(data.toString('hex'));
        //var bdata = new Buffer(data, 'binary').toString('base64');//data.toString('base64')
        var bdata = data.toString('base64');
        row.put('binary:doc',bdata,function(err, success){
            if(err) throw err;
            console.log('document saved ');
            row.get('binary:doc', function(err, data){
                if(err) throw err;
//                var buf = new Buffer(data[0].$,'hex');
                var buf = new Buffer(data[0].$,'base64');
//                console.log(buf);
                fs.writeFile('copy-Chinese.png',buf, function (err) {
                    if(err) throw err;
                    var etime = new Date();
                    console.log('dump from db, cost: '+(etime-btime));
                    if(callback)callback();
                });
            });
        });
    });
}

var testNewApi = function(){
    var HBase = require('hbase-client');
    var fs = require('fs');
    var client = HBase.create({
        zookeeperHosts: [
            'ball:2222'
        ],
        zookeeperRoot: '/hbase'
    });
    fs.readFile('Chinese.png', function (err, data) {
        var hdata = {"binary:doc":data,"basic:filename":"文件名是Chinese.jpg"};
        client.putRow('crawled_bin', 'image',hdata , function (err) {
            if(err) throw err;
            console.log('file saved');
            client.getRow('crawled_bin',  'image', ['binary:doc','basic:filename'], function (err, row) {
                if(err) throw err;
                fs.writeFile('copy-Chinese.png',row['binary:doc'], function (err) {
                    if(err) throw err;
                    console.log('dump from db' + row['basic:filename']);
                });
            });
        });
    });
}

var testDownload = function(){
    var HBase = require('hbase-client');
    var fs = require('fs');
    var client = HBase.create({
        zookeeperHosts: [
            'backee:2222'
        ],
        zookeeperRoot: '/hbase'
    });
        client.getRow('binary_raw_web',  '43f4103ceb4d096014d26abe74f815c7', ['binary:file','basic:url'], function (err, row) {
            if(err) throw err;
            fs.writeFile('copy-Chinese.jpg',row['binary:file'], function (err) {
                if(err) throw err;
                console.log('dump from db' + row['basic:url']);
            });
        });
}

var upAndDown = function(callback) {
    var hbase  = require('../lib/node_hbase/index.js');

    var client = hbase({
        zookeeperHosts: ["ball:2181"],
        zookeeperRoot: "/hbase",
        rootRegionZKPath: "/meta-region-server",
        rpcTimeout: 30000,
        pingTimeout: 30000,
        callTimeout: 5000
    });

    var fs = require('fs');


    var tableName = 'crawled_bin'

    fs.readFile('Chinese.png', function (err, data) {
        var btime = new Date();
        var put1 = new hbase.Put('image1');
        put1.add('binary', 'doc', data);
        var put2 = new hbase.Put('image1');
        put2.add('basic', 'filename', 'Chinese.png');
        client.mput(tableName, [put1, put2], function (err, res) {
            if(err) throw err;
            console.log('file saved');
            var get = new hbase.Get('image1');
            client.get(tableName, get, function(err, res) {
                if(err) throw err;
                console.log('row: '+res['row'].toString());
                fs.writeFile('copy-Chinese.png',res['cols']['binary:doc']['value'], function (err) {
                    if(err) throw err;
                    var etime = new Date();
                    console.log('dump from db' + res['cols']['basic:filename']['value']+', cost: '+(etime-btime));
                    client = null;
                    if(callback)callback();
                });
            });
        });
    });
}

upAndDown();


//testDownload();
//testOldAPI();
//testNewApi();

//var async = require('async');
//var bbtime = new Date();
//
//var count = 0;
//async.whilst(
//    function(){
//        return count++<1000;
//    },
//    function(callback){
//        testOldAPI(function(cb){
//            callback();
//        });
//    },
//    function(err){
//        var eetime = new Date();
//        console.log('Total cost: '+(eetime-bbtime));
//    }
//);

