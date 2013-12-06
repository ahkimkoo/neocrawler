/**
 * super scheduler
 */
var util = require('util');
var events = require('events');
var redis = require("redis");
var crypto = require('crypto');

var scheduler = function(settings){
    events.EventEmitter.call(this);//eventemitter inherits
    this.settings = settings;
    logger = settings.logger;
    this.priotities_updated = 0;
    /*
    {
        items:{
            1:
            {
              volume:150,
              items:{
                driller:blabla:
                   {
                   type:'FIFO',
                   weight:50,
                   first_schedule:238947329847832,
                   last_schedule:238947329847832
                   }
              }
            }
        }
        nums:[]
    }
     */
    this.priotities = {'items':{},'nums':[]};
    this.priotity_list = [];
    this.total_rates = 0;
    this.driller_rules = {};
    this.redis_cli0 = redis.createClient(this.settings['driller_info_redis_db'][1],this.settings['driller_info_redis_db'][0]);
    this.redis_cli1 = redis.createClient(this.settings['url_info_redis_db'][1],this.settings['url_info_redis_db'][0]);
}
util.inherits(scheduler, events.EventEmitter);//eventemitter inherits

scheduler.prototype.assembly = function(){
    var scheduler = this;
    scheduler.redis_cli0.select(this.settings['driller_info_redis_db'][2], function(err,value) {
        scheduler.redis_cli1.select(scheduler.settings['url_info_redis_db'][2], function(err,value) {
            scheduler.emit('standby','schedule');
        });
    });
}

scheduler.prototype.refreshPriotities  = function(){
    var scheduler = this;
    var redis_cli = this.redis_cli0;
        redis_cli.get('updated:driller:rule',function(err,value){
            if (err)throw(err);
            if(this.priotities_updated!==parseInt(value)){//driller is changed
                logger.debug('driller rules is changed');
                redis_cli.keys('driller:*',function(err,values){
                    if (err)throw(err);
                    scheduler.tmp_driller_rules = {};
                    scheduler.tmp_priotities = {'items':{},nums:[]};
                    scheduler.tmp_priority_list = [];
                    scheduler.tmp_total_rates = 0;
                    scheduler.tmp_priotites_length = values.length;
                    for(var i=0;i<values.length;i++){
                        (function(key,scheduler){
                            redis_cli.hgetall(key, function(err,value){//for synchronized using object variable
                                if(scheduler.tmp_priotities==undefined)scheduler.tmp_priotities = {'items':{},nums:[]};
                                var isActive = JSON.parse(value['active']);
                                if(isActive){
                                    ////for priority
                                    if(scheduler.tmp_priotities['items'][value['priority']]==undefined)scheduler.tmp_priotities['items'][value['priority']]={'volume':0,'items':{}};
                                    scheduler.tmp_priotities['items'][value['priority']]['volume'] += parseInt(value['weight']);
                                    scheduler.tmp_priotities['items'][value['priority']]['items'][key]={
                                        'type':value['schedule_rule'],
                                        'weight':parseInt(value['weight']),
                                        'first_schedule':value['first_schedule']!=undefined?value['first_schedule']:0,
                                        'last_schedule':value['last_schedule']!=undefined?value['last_schedule']:0
                                    };
                                    ////for drill_rules
                                    if(scheduler.tmp_driller_rules==undefined)scheduler.tmp_driller_rules = {};
                                    if(scheduler.tmp_driller_rules[value['domain']]==undefined)scheduler.tmp_driller_rules[value['domain']]={};
                                    scheduler.tmp_driller_rules[value['domain']][value['alias']] = value;
                                    ///for priority list
                                    var rate = parseFloat(value['weight'])/parseFloat(value['priority'])
                                    scheduler.tmp_total_rates += rate;
                                    scheduler.tmp_priority_list.push({
                                        'key':key,
                                        'rate':rate,
                                        'rule':value['schedule_rule'],
                                        'interval':parseInt(value['schedule_interval']),
                                        'first_schedule':value['first_schedule']!=undefined?parseInt(value['first_schedule']):0,
                                        'last_schedule':value['last_schedule']!=undefined?parseInt(value['last_schedule']):0,
                                        'seed':JSON.parse(value['seed'])
                                    });
                                }
                                scheduler.tmp_priotites_length--;
                                if(scheduler.tmp_priotites_length<=0){
                                    scheduler.priotities = scheduler.tmp_priotities;
                                    scheduler.driller_rules = scheduler.tmp_driller_rules;
                                    scheduler.priotity_list = scheduler.tmp_priority_list;
                                    scheduler.total_rates = scheduler.tmp_total_rates;
                                    //scheduler.priotities_updated = (new Date()).getTime();
                                    logger.debug('priotities loaded finish');
                                    scheduler.emit('priotities_loaded',scheduler.priotities);
                                    setTimeout(function(){scheduler.refreshPriotities();},scheduler.settings['check_driller_rules_interval']);
                                }
                            });
                        })(values[i],scheduler);
                    }
                });
                this.priotities_updated=parseInt(value);
            }else{
                logger.debug('driller rules is not changed');
                setTimeout(function(){scheduler.refreshPriotities();},scheduler.settings['check_driller_rules_interval']);
            }
        });
}

scheduler.prototype.doSchedule = function(){
    var scheduler =  this;
    var redis_cli = scheduler.redis_cli0;
        redis_cli.llen('queue:scheduled:all',function(err, queue_length) {
            if(err)throw(err);
            var balance = scheduler.settings['schedule_quantity_limitation'] - queue_length;
            var avg_rate = balance/scheduler.total_rates;
            logger.debug(util.format('Schedule, queue length: %s, balance: %s, avg_rate: %s',queue_length,balance,avg_rate));
            scheduler.emit('schedule_circle',-1,avg_rate,0);
        });
}

scheduler.prototype.reSchedule = function(driller,index){
    var scheduler = this;
    logger.debug('reschedule '+driller['key']);
    for(var i=0;i<driller['seed'].length;i++){
        (function(link){
            scheduler.redis_cli0.rpush('queue:scheduled:all',link,function(err, value){
                logger.debug('reschedule url: '+link);
            });
        })(driller['seed'][i])
    }
    var ntime = (new Date()).getTime();
    this.priotity_list[index]['first_schedule'] = ntime;
    this.redis_cli0.hset(driller['key'],'first_schedule',ntime,function(err,value){
        if(err)logger.error('update first schedule time for '+driller['key']+' failure');
        else logger.debug('update first schedule time for '+driller['key']+' successful');
    });
}

scheduler.prototype.doScheduleExt = function(index,avg_rate,more){
    var scheduler = this;
    var xdriller = this.priotity_list[index];
    //--check reschedule-------------
    if((new Date()).getTime()-xdriller['first_schedule']>=xdriller['interval']*1000)this.reSchedule(xdriller,index);
    //-------------------------------
    var redis_cli0 = this.redis_cli0;
        redis_cli0.llen('urllib:'+xdriller['key'],function(err, queue_length) {
            var ct = Math.ceil(avg_rate * xdriller['rate'])+more;
            var act = queue_length>=ct?ct:queue_length;
            logger.debug(xdriller['key']+' queue length: '+queue_length+', actual quantity: '+act);
            for(var i=0;i<act;i++){
                if(xdriller['rule']=='LIFO'){
                    redis_cli0.rpop('urllib:'+xdriller['key'],function(err, url){
                            scheduler.checkURL(url,xdriller['interval']);
                    })
                }else{
                    redis_cli0.lpop('urllib:'+xdriller['key'],function(err, url){
                        scheduler.checkURL(url,xdriller['interval']);
                    })
                }
            }
            scheduler.emit('schedule_circle',index,avg_rate,ct-act);
        });
}

scheduler.prototype.checkURL = function(url,interval){
    var redis_cli0 = this.redis_cli0;
    var redis_cli1 = this.redis_cli1;
    var kk = crypto.createHash('md5').update(url).digest('hex');
    redis_cli1.hgetall(kk,function(err,values){
        if(err)throw(err);
        if(!values)return;
        var status = values['status'];
        var records = JSON.parse(values['records']);
        var last = parseInt(values['last']);
        if((new Date()).getTime()-last>=interval||status!='crawling'){
            redis_cli0.rpush('queue:scheduled:all',url,function(err,value){
                logger.debug('Append '+url+' to queue');
            });
        }else{
            logger.debug('ignore '+url);
        }
    });
}

scheduler.prototype.start = function(){
    var scheduler = this;

    this.once('standby',function(middleware){
        logger.debug(middleware+' stand by');
        this.refreshPriotities();
    });

    this.on('schedule_circle',function(index,avg_rate,more){
        if(index<this.priotity_list.length-1)this.doScheduleExt(++index,avg_rate,more);
        else {
            setTimeout(function(){scheduler.doSchedule()},this.settings['schedule_interval']*1000);
        }
    });

    this.on('priotities_loaded',function(priotities){
        this.priotities['nums'] = [];
        for(var i in this.priotities['items']){
            this.priotities['nums'].push(i);
        }
        this.priotities['nums'].sort();

        this.priotity_list.sort(function(a,b){
            return b['rate'] - a['rate'];
        });

        this.doSchedule();
    });
    //trigger//////////////
    this.assembly();
}


module.exports = scheduler;