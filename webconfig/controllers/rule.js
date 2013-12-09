var rule = require('../models/drillingRule.js');

//default
var template =  {
        id:'',
        domain: '',
        url_pattern: '',
        alias: '',
        encoding: 'UTF8',
        type: 'node', //branch or node
        save_page: 'true',
        jshandle: 'false',
        cookie: '[""]',
        inject_jquery: 'false',
        load_img: 'false',
        drill_rules: '[""]',
        script: '[""]',
        navigate_rule: '[""]',
        stoppage: -1,
        priority: 1,
        weight: 10,
        schedule_interval: 86400,
        active: 'true',
        seed:'[""]',
        schedule_rule:'FIFO'}; // FIFO  or LIFO

var rules = [];

// index displaying all the drilling rules
exports.index = function(req, res) {

   rule.getDrillingRules(function(err, result){
       rules = result; 
       var totalPage = result.length / 15;
       if(totalPage > 0) {            
            rules = result.slice(0, 15);
       }
       res.render('rule/index', {title : 'Drilling rule', rules:rules, totalPage:totalPage});
   });  
};

// search
exports.search = function(req, res) {

  res.cookie("domain",req.body.domain, { maxAge: 900000, httpOnly: true });

    var domain = req.body.domain;
    console.log('search:', domain);
   rule.getRulesByCondition(domain,function(err, result){
       rules = result; 
       res.render('rule/index', {title : 'Drilling rule', rules:result});
   });  
};

// display new rule form
exports.new = function(req, res) {
    var filePath = require('path').normalize(__dirname + "/../public/rule/new.html");
    res.sendfile(filePath);

    //var filePath = require('path').normalize(__dirname + "/../public/rule/added.html");
    //res.render('rule/new', {title : 'New rule'});  
};

// add a rule
exports.create = function(req, res) {
  // get key and rule from form
  var domain = req.body.domain;
  var alias = req.body.alias;
  var key = 'driller:' + domain + ':' + alias;

  console.log("key", key);
  //console.log("url:", urlencode(req.body.url_pattern));
   
    // add rule
    template['domain'] = req.body.domain;
    template['url_pattern'] = req.body.url_pattern;
    template['alias'] = req.body.alias;
    template['encoding'] = req.body.encoding;
    template['type'] = req.body.type;
    template['save_page'] = req.body.save_page;
    template['jshandle'] = req.body.jshandle;
    template['cookie'] = req.body.cookie;
    template['inject_jquery'] = req.body.inject_jquery;
    template['load_img'] = req.body.load_img;
    template['drill_rules'] = req.body.drill_rules;
    template['script'] = req.body.script;
    template['navigate_rule'] = req.body.navigate_rule;
    template['stoppage'] = req.body.stoppage;
    template['priority'] = req.body.priority;
    template['weight'] = req.body.weight;
    template['schedule_interval'] = req.body.schedule_interval;
    template['active'] = req.body.active;
    template['seed'] = req.body.seed;
    template['schedule_rule'] = req.body.schedule_rule;   
    template['id'] = key;

    rule.create(key, template, function(err, result){
        if(!err) {

        }
    });

    res.redirect('rule');
};

// show a specific rule
exports.show = function(req, res) {
  var id = req.params.id;
  console.log('show id:', id);
  rule.displayOne(id, function(err, obj){
    /*
      if(obj)   
          res.send('There is no rule with id of ' + req.params.id);
      else*/
        console.log('obj:', obj);
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
        obj['id'] = id;
        console.log("obj:", obj);
        res.render('rule/edit', {title : 'Edit rule', rule:obj});        
      }else{
        res.render('rule/edit', {title : 'Edit rule', rule:template});        
      }
   });
};

// upsert a rule
exports.update = function(req,res) {
    var id = "driller:" + req.body.domain + ":" + req.body.alias;
    // upsert rule
    template['domain'] = req.body.domain;
    template['url_pattern'] = req.body.url_pattern;
    template['alias'] = req.body.alias;
    template['encoding'] = req.body.encoding;
    template['type'] = req.body.type;
    template['save_page'] = req.body.save_page;
    template['jshandle'] = req.body.jshandle;
    template['cookie'] = req.body.cookie;
    template['inject_jquery'] = req.body.inject_jquery;
    template['load_img'] = req.body.load_img;
    template['drill_rules'] = req.body.drill_rules;
    template['script'] = req.body.script;
    template['navigate_rule'] = req.body.navigate_rule;
    template['stoppage'] = req.body.stoppage;
    template['priority'] = req.body.priority;
    template['weight'] = req.body.weight;
    template['schedule_interval'] = req.body.schedule_interval;
    template['active'] = req.body.active;
    template['seed'] = req.body.seed;
    template['schedule_rule'] = req.body.schedule_rule;   
    template['id'] = id;

    console.log("edit update:", req.body.drill_rules);

   rule.update(id, template, function(err, result){
      if(!err){
                     
          rule.getDrillingRules(function(err, result){
            rules = result; 
            //res.render('rule/index', {title : 'Drilling rule', rules:result});
            console.log('Rule', id, 'updated.'); 
            res.redirect('rule');
      });
    }
   });  
};
