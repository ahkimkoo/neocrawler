/**
 * Created by cherokee on 14-4-18.
 */
require('../lib/jsextend.js');

var testOldAPI = function(){
    var hbase = require('hbase');
    var fs = require('fs');
    var path = require('path');

    var hbase_cli = hbase({
        host:'backee',
        port:8080
    });

    var hbase_table = hbase_cli.getTable('subject_raw_doc');

    var row = hbase_table.getRow('image');

    fs.readFile('hbase-demo.tar.gz', function (err, data) {
        if (err) throw err;
//    console.log(data.toString('hex'));
        row.put('binary:doc',data.toString('base64'),function(err, success){
            if(err) throw err;
            console.log('document saved ');
            row.get('binary:doc', function(err, data){
                if(err) throw err;
                var buf = new Buffer(data[0].$,'hex');
                console.log(buf);
                fs.writeFile('copy-hbase-demo.tar.gz',buf, function (err) {
                    if(err) throw err;
                    console.log('dump from db');
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
            'backee:2222'
        ],
        zookeeperRoot: '/hbase'
    });
    fs.readFile('Chinese.jpg', function (err, data) {
        var hdata = {"binary:doc":data,"basic:filename":"文件名是Chinese.jpg"};
        client.putRow('subject_raw_doc', 'image',hdata , function (err) {
            if(err) throw err;
            console.log('file saved');
            client.getRow('subject_raw_doc',  'image', ['binary:doc','basic:filename'], function (err, row) {
                if(err) throw err;
                fs.writeFile('copy-Chinese.jpg',row['binary:doc'], function (err) {
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
testDownload();