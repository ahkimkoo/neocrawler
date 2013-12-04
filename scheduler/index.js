/**
 * super scheduler
 */
var util = require('util');
var events = require('events');
var redis = require("redis");

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
}
util.inherits(scheduler, events.EventEmitter);//eventemitter inherits

scheduler.prototype.refreshPriotities  = function(){
    var spiderCore = this;
    var redis_cli = redis.createClient(this.settings['driller_info_redis_db'][1],this.settings['driller_info_redis_db'][0]);
    redis_cli.select(this.settings['driller_info_redis_db'][2], function(err, value) {
        if (err)throw(err);
        redis_cli.get('updated:driller:rule',function(err,value){
            if (err)throw(err);
            if(this.priotities_updated!==parseInt(value)){//driller is changed
                logger.debug('driller rules is changed');
                redis_cli.keys('driller:*',function(err,values){
                    if (err)throw(err);
                    spiderCore.tmp_priotities = {'items':{},nums:[]};
                    spiderCore.tmp_priotites_length = values.length;
                    for(var i=0;i<values.length;i++){
                        (function(key,spiderCore){
                            redis_cli.hgetall(key, function(err,value){//for synchronized using object variable
                                if(spiderCore.tmp_priotities==undefined)spiderCore.tmp_priotities = {'items':{},nums:[]};
                                var isActive = JSON.parse(value['active']);
                                if(isActive){
                                    if(spiderCore.tmp_priotities['items'][value['priority']]==undefined)spiderCore.tmp_priotities['items'][value['priority']]={'volume':0,'items':{}};
                                    spiderCore.tmp_priotities['items'][value['priority']]['volume'] += parseInt(value['weight']);
                                    spiderCore.tmp_priotities['items'][value['priority']]['items'][key]={
                                        'type':value['schedule_rule'],
                                        'weight':parseInt(value['weight']),
                                        'first_schedule':value['first_schedule']!=undefined?value['first_schedule']:0,
                                        'first_schedule':value['last_schedule']!=undefined?value['last_schedule']:0
                                    };
                                }
                                spiderCore.tmp_priotites_length--;
                                if(spiderCore.tmp_priotites_length<=0){
                                    spiderCore.priotities = spiderCore.tmp_priotities;
                                    //spiderCore.priotities_updated = (new Date()).getTime();
                                    spiderCore.emit('priotities_loaded',spiderCore.priotities);
                                    setTimeout(function(){spiderCore.refreshPriotities();},spiderCore.settings['check_driller_rules_interval']);
                                    redis_cli.quit();
                                }
                            });
                        })(values[i],spiderCore);
                    }
                });
                this.priotities_updated=parseInt(value);
            }else{
                logger.debug('driller rules is not changed');
                setTimeout(function(){spiderCore.refreshDrillerRules();},spiderCore.settings['check_driller_rules_interval']);
                redis_cli.quit();
            }
        });
    });
}

scheduler.prototype.start = function(){
    this.on('priotities_loaded',function(priotities){
        this.priotities['nums'] = [];
        for(var i in this.priotities['items']){
            this.priotities['nums'].push(i);
        }
        this.priotities['nums'].sort();
        logger.debug(JSON.stringify(this.priotities));
    });
    //trigger//////////////
    this.refreshPriotities();
}


module.exports = scheduler;