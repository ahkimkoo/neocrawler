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
    this.priotity_list = [];//[{"key":"...","rate":"...","rule":"...","interval":"...","first_schedule":"...","last_schedule":"...","seed":"..."}]
    this.max_weight = 100;
    this.total_rates = 0;
    this.driller_rules = {};//{"domain":{"alias":{"rules":"..."}}}
    this.redis_cli0 = redis.createClient(this.settings['driller_info_redis_db'][1],this.settings['driller_info_redis_db'][0]);
    this.redis_cli1 = redis.createClient(this.settings['url_info_redis_db'][1],this.settings['url_info_redis_db'][0]);
}
util.inherits(scheduler, events.EventEmitter);//eventemitter inherits
/**
 * assembly: initializing
 */
scheduler.prototype.assembly = function(){
    var scheduler = this;
    scheduler.redis_cli0.select(this.settings['driller_info_redis_db'][2], function(err,value) {
        scheduler.redis_cli1.select(scheduler.settings['url_info_redis_db'][2], function(err,value) {
            scheduler.emit('standby','schedule');
        });
    });
}
/**
 * refresh driller rules periodically
 */
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
                    scheduler.tmp_priority_list = [];
                    scheduler.tmp_total_rates = 0;
                    scheduler.tmp_priotites_length = values.length;
                    for(var i=0;i<values.length;i++){
                        (function(key,scheduler){
                            redis_cli.hgetall(key, function(err,value){//for synchronized using object variable
                                if(scheduler.tmp_priotities==undefined)scheduler.tmp_priotities = {'items':{},nums:[]};
                                var isActive = JSON.parse(value['active']);
                                if(isActive){
                                    ////for drill_rules
                                    if(scheduler.tmp_driller_rules==undefined)scheduler.tmp_driller_rules = {};
                                    if(scheduler.tmp_driller_rules[value['domain']]==undefined)scheduler.tmp_driller_rules[value['domain']]={};
                                    scheduler.tmp_driller_rules[value['domain']][value['alias']] = value;
                                    ///for priority list
                                    var rate = (scheduler.max_weight + parseFloat(value['weight']))/parseFloat(value['priority'])
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
                                    scheduler.driller_rules = scheduler.tmp_driller_rules;
                                    scheduler.priotity_list = scheduler.tmp_priority_list;
                                    scheduler.total_rates = scheduler.tmp_total_rates;
                                    //scheduler.priotities_updated = (new Date()).getTime();
                                    logger.debug('priorities loaded finish');
                                    scheduler.emit('priorities_loaded',scheduler.priotity_list);
                                    setTimeout(function(){scheduler.refreshPriotities();},scheduler.settings['check_driller_rules_interval']*1000);
                                }
                            });
                        })(values[i],scheduler);
                    }
                });
                this.priotities_updated=parseInt(value);
            }else{
                logger.debug('driller rules is not changed');
                setTimeout(function(){scheduler.refreshPriotities();},scheduler.settings['check_driller_rules_interval']*1000);
            }
        });
}
/**
 * schedule wrapper
 */
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
/**
 * re-schedule: periodically append seeds to queue
 * @param driller
 * @param index
 */
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
/**
 * Actually do schedule in this method
 * @param index
 * @param avg_rate
 * @param more
 */
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
            logger.debug(util.format('%s, rate:%d, queue length:%d, actual quantity:%d',xdriller['key'],xdriller['rate'],queue_length,act));
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
/**
 * check the url, whether insert to urllib
 * @param url
 * @param interval
 */
scheduler.prototype.checkURL = function(url,interval){
    if(typeof(url)!=='string'){
        logger.error(util.format('Invalidate url: %s',url));
        return;
    }
    var redis_cli0 = this.redis_cli0;
    var redis_cli1 = this.redis_cli1;
    var kk = crypto.createHash('md5').update(url).digest('hex');
    redis_cli1.hgetall(kk,function(err,values){
        if(err)throw(err);
        if(!values)return;
        var status = values['status'];
        var records = JSON.parse(values['records']);
        var last = parseInt(values['last']);

        if(status!='crawled_failure'&&status!='hit'){
            var real_interval = interval*1000;
            if(status=='crawling'){
                real_interval = 5*60*1000;//url request hang up or interrupted, give opportunity to crawl after 5 minutes.
            }
            if((new Date()).getTime()-last<real_interval){
                logger.debug(util.format('ignore %s, last event time:%s, status:%s',url,last,status));
                return;
            }
        }

        redis_cli0.rpush('queue:scheduled:all',url,function(err,value){
            logger.debug('Append '+url+' to queue');
        });

    });
}
/**
 * entrance, other module feel free to call this method
 */
scheduler.prototype.start = function(){
    var scheduler = this;
    //after module initial
    this.once('standby',function(middleware){
        logger.debug(middleware+' stand by');
        this.refreshPriotities();
    });
    //pass schedule info one by one
    this.on('schedule_circle',function(index,avg_rate,more){
        if(index<this.priotity_list.length-1)this.doScheduleExt(++index,avg_rate,more);
        else {
            setTimeout(function(){scheduler.doSchedule()},this.settings['schedule_interval']*1000);
        }
    });
    //when refresh priority list finished
    this.on('priorities_loaded',function(priotity_list){
        this.priotity_list.sort(function(a,b){
            return b['rate'] - a['rate'];
        });

        this.doSchedule();
    });

    //trigger//////////////
    this.assembly();
}


module.exports = scheduler;