/**
 * test
 */

var fake_proxy = function(){
    var redis = require("redis");
    var fs = require("fs");

    fs.readFile('proxy.txt','utf-8', function (err, data) {
          if (err) throw err;
          var proxylist = data.split("\n");

          var redis = require("redis");
          client = redis.createClient(6379,'127.0.0.1');
          client.select(3, function() {
              for(x in proxylist){
                  if(proxylist[x]!=='')client.rpush('proxy:public:available:3s',proxylist[x]);
                  console.log('rpush '+proxylist[x]);
              }
              client.quit();
          });

        });
}

var fake_drill_rules = function(){
    var redis = require("redis");
    var k = 'driller:amazon.cn:bestsellers';
    var v = {
        'domain':'amazon.cn',
        'alias':'bestsellers',
        'url_pattern':encodeURIComponent('^http://www.amazon.cn/gp/bestsellers.*$'),
        'encoding':'UTF-8',
        'type':'branch',
        'save_page':true,
        'jshandle':false,
        'cookie':JSON.stringify([]),
        'inject_jquery':false,
        'load_img':false,
        'drill_rules':JSON.stringify(['#zg_browseRoot a']),
        'script':JSON.stringify([]),
        'navigate_rule':JSON.stringify([]),
        'stoppage':-1,
        'priority':2,
        'weight':10,
        'schedule_interval':3600,
        'active':true,
        'seed':JSON.stringify(['http://www.amazon.cn/gp/bestsellers']),
        'schedule_rule':"FIFO"
    }

    client = redis.createClient(6379,'127.0.0.1');
    client.select(0, function(err, value) {
        client.hmset(k,v,function(err, value){
            if (err) throw(err);
            console.log('faked rules inserted.');
        });
        client.quit();
    });
}

var fake_url_lib = function(){
    var redis = require("redis");
    var crypto = require('crypto');
    var k = 'urllib:driller:amazon.cn:bestsellers';
    var v = [
        'http://www.amazon.cn/gp/bestsellers/audio-video/ref=zg_bs_nav_0',
        'http://www.amazon.cn/gp/bestsellers/digital-text/ref=zg_bs_nav_0',
        'http://www.amazon.cn/gp/bestsellers/office-products/ref=zg_bs_nav_0',
        'http://www.amazon.cn/gp/bestsellers/pc/ref=zg_bs_nav_0',
        'http://www.amazon.cn/gp/bestsellers/pc/2028178051/ref=zg_bs_nav_pc_1_pc'
    ]
    client0 = redis.createClient(6379,'127.0.0.1');
    client1 = redis.createClient(6379,'127.0.0.1');
    client0.select(0, function(err, value) {
        for(var i=0;i<v.length;i++){
            var itm = v[i];
            (function(itm){
            /////////////////
            client0.rpush(k,itm,function(err, value){
                if (err)throw(err);
                console.log(itm+' inserted to list.');
                client1.select(1, function(err, value){
                    var kk = crypto.createHash('md5').update(itm+'').digest('hex');
                    var vv = {
                        'url':itm,
                        'referer':'http://www.amazon.cn/',
                        'create':(new Date()).getTime(),
                        'records':JSON.stringify([]),
                        'status':'hit'
                    }
                    client1.hmset(kk,vv,function(err, value){
                        if (err) throw(err);
                        console.log(itm+' information saved.');
                        client1.quit();
                        client0.quit();
                    });
                });
                //client1.quit();
            });
            ///////////////////
            })(itm);
        }
        //client0.quit();
    });
}
fake_drill_rules();
//fake_url_lib();