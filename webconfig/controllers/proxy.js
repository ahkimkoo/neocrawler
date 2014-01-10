var proxyManager = require('../models/proxyManagement.js');

var proxyList = [];

var template =  {
        key:'',
        address: '',
        authorize: '',
        group: ''};

PROXY_P_PREFIX = 'proxy:public:available:';
PROXY_P_KEY1S = 'proxy:public:available:1s';
PROXY_P_KEY3S = 'proxy:public:available:3s';
PROXY_P_KEY5S = 'proxy:public:available:5s';
PROXY_P_KEY8S = 'proxy:public:available:8s';
PROXY_P_KEY12S = 'proxy:public:available:12s';
PROXY_P_KEY20S = 'proxy:public:available:20s';

PROXY_V_PREFIX = 'proxy:vip:available:';
PROXY_V_KEY1S = 'proxy:vip:available:1s';
PROXY_V_KEY3S = 'proxy:vip:available:3s';
PROXY_V_KEY8S = 'proxy:vip:available:8s';
PROXY_V_KEY15S = 'proxy:vip:available:15s';

// index displaying all available proxy list
exports.index = function(req, res) {
   
   proxyManager.getProxyList(function(err, result){
     //proxyList = result;
     proxyList = [];
        console.log("proxy list:", result);
       res.render('proxy/index', {title : 'Available Proxy List', proxyList:result});
   });  
};

// display new proxy form
exports.new = function(req, res) {
    var filePath = require('path').normalize(__dirname + "/../public/proxy/new.html");
    res.sendfile(filePath);
};

exports.create = function(req, res) {
    console.log("address:", req.body.address);
    console.log("authorize:", req.body.authorize);
    console.log("group:", req.body.group);

    var group = req.body.group;
    var key;
    if(group[0] === 'p'){
      key = PROXY_P_PREFIX + group.substring(1);
    }else{
      key = PROXY_V_PREFIX + group.substring(1);
    }
    console.log("key:", key);    

    template['address'] = req.body.address;
    template['authorize'] = req.body.authorize;
    template['group'] = req.body.group;
    template['key'] = key;

    proxyManager.create(key, template['address'], function(err, result){
        if(!err) {
            
         } 
    });
    res.redirect('proxy');
};

// delete a widget
exports.destroy = function(req,res) {
  var host = req.params.host;
  var key = req.params.key;

  console.log(host, key);
  proxyManager.destroy(key, host, function(err, result){

        console.log('Host', host, 'deleted.');  
          
        if(!err) {
           
                //console.log("list:", result);
               

         }  
         res.redirect('proxy'); 
  });

};