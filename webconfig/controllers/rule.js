var rule = require('../models/drillingRule.js');

//default
var template =  {
        'domain': '',
        'url_pattern': '',
        'alias': '',
        'id_parameter': [],
        'encoding': 'auto',
        'type': 'node', //branch or node
        'save_page': true,
        'format': 'html',//html or json or binary
        'jshandle': false,
        'extract_rule':{
            'category':'crawled',
            'rule':{
                'title':{'base':'content','mode':'css','expression':'title','pick':'text','index':1}
            }
        },
        'cookie': [],
        'inject_jquery': false,
        'load_img': false,
        'drill_rules': [],
        'drill_relation': {
            'base':'content','mode':'css','expression':'title','pick':'text','index':1
        },
        'validation_keywords': [],
        'script': [],
        'navigate_rule': [],
        'stoppage': -1,
        'priority': 1,
        'weight': 10,
        'schedule_interval': 86400,
        'active': true,
        'seed': [],//[]
        'schedule_rule':'FIFO',// FIFO  or LIFO
        'use_proxy':false
};

var rules = [];

// index displaying all the drilling rules
exports.index = function(req, res) {

  //req.session.searchBox = "";

  if(req.session.list == null){
    req.session.searchBox = "";
     rule.getDrillingRules(function(err, result){
         rules = result; 
         req.session.list = rules;
         var totalPage = result.length / 15;
         if(totalPage > 0) {            
              rules = result.slice(0, 15);
         }
         res.render('rule/index', {title : 'Drilling rule', session:req.session, totalPage:totalPage});
     });     
      
  }else{
      //req.session.searchBox = domain;
      res.render('rule/index', {title : 'Drilling rule', session:req.session});
  }
 
};

// search
exports.search = function(req, res) {

    var domain = req.body.domain;
    req.session.searchBox = domain;
    console.log('search:', domain);
    rule.getRulesByCondition(domain,function(err, result){
       rules = result; 
       req.session.list = rules;
       res.render('rule/index', {title : 'Drilling rule', session:req.session});
   });  
};

// display new rule form
exports.new = function(req, res) {
    var filePath = require('path').normalize(__dirname + "/../public/rule/new.html");
    res.sendfile(filePath);

    //var filePath = require('path').normalize(__dirname + "/../public/rule/added.html");
    //res.render('rule/new', {title : 'New rule'});  
};

// add a rule, ****not use****
exports.create = function(req, res) {
  // get key and rule from form
    var jsonstr = req.body.jsondata;
    var jsonobj = JSON.parse(jsonstr);
    var key = 'driller:' + jsonobj['domain'] + ':' + jsonobj['alias'];

    console.log("key", key);
    //console.log("url:", urlencode(req.body.url_pattern));

    rule.create(key, jsonobj, function(err, result){
        if(!err) {

        }
    });

    res.redirect('rule');
};

// show a specific rule
exports.show = function(req, res) {
  var id = req.params.id;
  rule.displayOne(id, function(err, obj){
    /*
      if(obj)   
          res.send('There is no rule with id of ' + req.params.id);
      else*/
          res.render('rule/show', {title : 'Show Rule', rule : obj});
  });
};

// delete a widget
exports.destroy = function(req,res) {
   var id = req.params.id;
   console.log("destroy id:", id);
   rule.destroy(id, function(err, obj){
      if(!err){
          console.log('Rule', req.params.id, 'deleted.');  
          rule.getDrillingRules(function(err, result){
          rules = result; 
          //res.render('rule/index', {title : 'Drilling rule', rules:result});
          res.redirect('rule');
      });
    }
   }); 
};

// display edit form
exports.edit = function(req, res) {
  var id = req.params.id;
  console.log("id:", id);
   rule.displayOne(id, function(err, obj){
      if(obj){
//        obj['id'] = id;
          var dataobj = template;
          var numberPattern = new RegExp("^\-?[0-9]+$");
          for(i in obj){
              if(obj.hasOwnProperty(i)){
                  if(typeof(obj[i])==='string'&&(obj[i].charAt(0)==='{'||obj[i].charAt(0)==='[')){
                      dataobj[i] = JSON.parse(obj[i]);
                  }else if(numberPattern.test(obj[i])){
                      dataobj[i] = parseInt(obj[i]);
                  }else if(obj[i]==='true'){
                      dataobj[i] = true;
                  }else if(obj[i]==='false'){
                      dataobj[i] = false;
                  }else dataobj[i] = obj[i];
              }
          }
        res.render('rule/edit', {title : 'Edit rule', rule:dataobj});
      }else{
        res.render('rule/edit', {title : 'Edit rule', rule:template});        
      }
   });
};

// upsert a rule
exports.update = function(req,res) {
    var jsonstr = req.body.jsondata;
    var jsonobj = JSON.parse(jsonstr);
    var key = 'driller:' + jsonobj['domain'] + ':' + jsonobj['alias'];

    //console.log("url:", urlencode(req.body.url_pattern));
    console.log("edit update:", req.body.drill_rules);

    //req.session.searchBox = req.body.domain;

    var dataobj = {};
    for(i in jsonobj){
        if(jsonobj.hasOwnProperty(i)){
            if(typeof(jsonobj[i])==='object')dataobj[i] = JSON.stringify(jsonobj[i]);
            else{
                dataobj[i] = jsonobj[i];}
        }
    }

   rule.update(key, dataobj, function(err, result){
      if(!err){
            /*         
          rule.getDrillingRules(function(err, result){
            rules = result; 
            req.session.list = rules;
            //res.render('rule/index', {title : 'Drilling rule', rules:result});
            console.log('Rule', id, 'updated.'); 
            res.redirect('rule');
      });
*/
    rule.getRulesByCondition(req.session.searchBox,function(err, result){
       rules = result; 
       req.session.list = rules;
       res.render('rule/index', {title : 'Drilling rule', session:req.session});
   }); 

    }
   });  
};
