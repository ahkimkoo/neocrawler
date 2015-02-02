/**
 * super scheduler
 */
var util = require('util');
var events = require('events');
var myredis = require('../lib/myredis.js');
var crypto = require('crypto');
var urlUtil =  require("url");
var querystring = require('querystring');
var async = require('async');
require('../lib/jsextend.js');

var scheduler = function(settings){
    events.EventEmitter.call(this);//eventemitter inherits
    this.settings = settings;
    logger = settings.logger;
    this.priotities_updated = 0;
    this.priotity_list = [];//[{"key":"...","rate":"...","rule":"...","interval":"...","first_schedule":"...","last_schedule":"...","seed":"..."}]
    this.max_weight = 100;
    this.total_rates = 0;
    this.driller_rules = {};//{"domain":{"alias":{"rules":"..."}}}
    this.schedule_version = (new Date()).getTime();
}
util.inherits(scheduler, events.EventEmitter);//eventemitter inherits
/**
 * assembly: initializing
 */
scheduler.prototype.assembly = function(){
    var self = this;
    var dbtype = 'redis';
    if(self.settings['use_ssdb'])dbtype = 'ssdb';
    async.series([
        function(cb){
            myredis.createClient(
                self.settings['driller_info_redis_db'][0],
                self.settings['driller_info_redis_db'][1],
                self.settings['driller_info_redis_db'][2],
                dbtype,
                function(err,cli){
                    self.redis_cli0 = cli;
                    cb(err);
                });
        },
        function(cb){
            myredis.createClient(
                self.settings['url_info_redis_db'][0],
                self.settings['url_info_redis_db'][1],
                self.settings['url_info_redis_db'][2],
                dbtype,
                function(err,cli){
                    self.redis_cli1 = cli;
                    cb(err);
                });
        }
    ],function(err,result){
        logger.debug('scheduler stand by');
        self.refreshPriotities();
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
                redis_cli.hlist('driller:*',function(err,values){
                    if (err)throw(err);
                    scheduler.tmp_driller_rules = {};
                    scheduler.tmp_priority_list = [];
                    scheduler.tmp_total_rates = 0;
                    scheduler.tmp_priotites_length = values.length;
                    for(var i=0;i<values.length;i++){
                        (function(key,scheduler){
                            redis_cli.hgetall(key, function(err,value){//for synchronized using object variable
                                if(scheduler.tmp_priotities==undefined)scheduler.tmp_priotities = {'items':{},nums:[]};
                                if(scheduler.tmp_driller_rules==undefined)scheduler.tmp_driller_rules = {};
                                var isActive = value['active']=='true'||value['active']==true||value['active']=='1'||value['active']==1?true:false;
                                if(isActive){
                                    ////for drill_rules
                                    logger.debug('Load rule: '+key);
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
                                }else logger.debug('Ignore rule: '+key+', status inactive');
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
    scheduler.schedule_version = (new Date()).getTime();
    var redis_cli = scheduler.redis_cli0;
        redis_cli.llen('queue:scheduled:all',function(err, queue_length) {
            if(err)throw(err);
            var balance = scheduler.settings['schedule_quantity_limitation'] - queue_length;
            if(balance<0)balance=0;
            var avg_rate = balance/scheduler.total_rates;
            logger.info(util.format('Schedule, candidate queue length: %s, balance: %s, average length: %s',queue_length,balance,avg_rate));

            var index = -1;
            var left = 0;
            async.whilst(
                function() { index++;return index < scheduler.priotity_list.length },
                function(cb) {
                    var xdriller = scheduler.priotity_list[index];
                    //--check reschedule-------------
                    if((new Date()).getTime()-xdriller['first_schedule']>=xdriller['interval']*1000)scheduler.reSchedule(xdriller,index);
                    //-------------------------------
                    scheduler.doScheduleExt(xdriller,avg_rate,left,function(more){
                        left = more;
                        cb();
                    });
                },
                function(err) {
                    if(err)logger.error(err);
                    logger.info('schedule round finish, sleep '+scheduler.settings['schedule_interval']+' s');
                    setTimeout(function(){scheduler.doSchedule()},scheduler.settings['schedule_interval']*1000);
                }
            );

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
    var links = [];
    for(var i=0;i<driller['seed'].length;i++){
        var link = driller['seed'][i];
        var link_arr = link.split('#');
        if(link_arr.length>=5){
            var min = parseInt(link_arr[2]);
            var max = parseInt(link_arr[3]);
            var scale = parseInt(link_arr[4]);
            for(var x=min;x<=max;x+=scale){
                links.push(link_arr[0]+x+link_arr[1]);
            }
        }else links.push(link);
    }

    for(var i=0;i<links.length;i++){
        (function(link){
            scheduler.updateLinkState(link,'schedule',scheduler.schedule_version,function(bol){
                if(bol){
                    scheduler.redis_cli0.rpush('queue:scheduled:all',link,function(err, value){
                        logger.info('reschedule url: '+link);
                    });
                }else{
                    logger.warn(util.format('reschedule(%s) failure, can not update link state',link));
                }
            });
        })(links[i])
    }
    this.priotity_list[index]['first_schedule'] = this.schedule_version;
    this.redis_cli0.hset(driller['key'],'first_schedule',this.schedule_version,function(err,value){
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
scheduler.prototype.doScheduleExt = function(xdriller,avg_rate,more,cb){
    var scheduler = this;
    var redis_cli0 = this.redis_cli0;
        redis_cli0.llen('urllib:'+xdriller['key'],function(err, queue_length) {
            if(err)cb(0);
            var ct = Math.ceil(avg_rate * xdriller['rate'])+more;
            var act = queue_length>=ct?ct:queue_length;
            logger.debug(util.format('%s, rate:%d, queue length:%d, actual quantity:%d',xdriller['key'],xdriller['rate'],queue_length,act));
            //use async//////////////////////////////////////////////////
            var count = 0;
            var pointer = true;//current point, false means end of list
            async.whilst(
                function (){ return count < ct && pointer; },
                function (callback) {
                    if(xdriller['rule']=='LIFO'){
                        redis_cli0.rpop('urllib:'+xdriller['key'],function(err, url){
                            pointer = url;
                            if(!err&&url){
                                logger.debug('fetch url '+url+' from urllib:'+xdriller['key']);
                                scheduler.checkURL(url,xdriller['interval'],function(bol){
                                    if(bol)count++;
                                    callback();
                                });
                            }else{
                                logger.debug('error or end of list, urllib:'+xdriller['key']);
                                callback();
                            }
                        })
                    }else{
                        redis_cli0.lpop('urllib:'+xdriller['key'],function(err, url){
                            pointer = url;
                            if(!err&&url){
                                logger.debug('fetch url '+url+' from urllib:'+xdriller['key']);
                                scheduler.checkURL(url,xdriller['interval'],function(bol){
                                    if(bol)count++;
                                    callback();
                                });
                            }else{
                                logger.debug('error or end of list, urllib:'+xdriller['key']);
                                callback();
                            }
                        })
                    }
                },
                function (err) {
                    if(err)log.error(err);
                    var left = 0;
                    if(count<ct)left = ct - count;
                    logger.debug('Schedule '+xdriller['key']+', '+count+'/'+ct+', left '+left);
                    cb(left);
                }
            );
           /////////////////////////////////////////////////////////////

        });
}

/**
 * get top level domain
 * www.baidu.com -> baidu.com
 * @param domain
 * @returns string
 * @private
 */
scheduler.prototype.__getTopLevelDomain = function(domain){
    var arr = domain.split('.');
    if(arr.length<=2)return domain;
    else return arr.slice(1).join('.');
}
/**
 * detect link which driller rule matched
 * @param link
 * @returns {string}
 */
scheduler.prototype.detectLink = function(link){
    var urlobj = urlUtil.parse(link);
    var result = '';
    var domain = this.__getTopLevelDomain(urlobj['hostname']);
    if(this.driller_rules[domain]!=undefined){
        var alias = this.driller_rules[domain];
        for(a in alias){
            if(alias.hasOwnProperty(a)){
                //var url_pattern  = decodeURIComponent(alias[a]['url_pattern']);
                var url_pattern  = alias[a]['url_pattern'];
                var patt = new RegExp(url_pattern);
                if(patt.test(link)){
                    result = 'driller:'+domain+':'+a;
                    break;
                }
            }
        }
    }
    return result;
}
/**
 * Transfer url, filter duplicated url base identical parameter
 * @param link
 * @param urllib
 * @returns {*}
 */
scheduler.prototype.transformLink = function(link,urllib){
    var final_link = link;
    var urlobj = urlUtil.parse(link);
    var domain = this.__getTopLevelDomain(urlobj['hostname']);
    var drill_alias = urllib.slice(urllib.lastIndexOf(':')+1);
    if(this.driller_rules[domain]&&this.driller_rules[domain][drill_alias]){
        var driller_rule = this.driller_rules[domain][drill_alias];
        if(typeof(driller_rule)!='object')driller_rule = JSON.parse(driller_rule);
        if(driller_rule['id_parameter']){
            var id_parameter = JSON.parse(driller_rule['id_parameter']);
            if(Array.isArray(id_parameter)&&id_parameter.length>0){
                var parameters = querystring.parse(urlobj.query);
                var new_parameters = {};
                for(var x=0;x<id_parameter.length;x++){
                    var param_name = id_parameter[x];
                    if(x==0&&param_name=='#')break;
                    if(parameters.hasOwnProperty(param_name))new_parameters[param_name] = parameters[param_name];
                }
                urlobj.search = querystring.stringify(new_parameters);
                final_link = urlUtil.format(urlobj);
            }
        }
    }
    return final_link
}

/**
 * check the url, whether insert to urllib
 * @param url
 * @param interval
 */
scheduler.prototype.checkURL = function(url,interval,callback){
    var scheduler = this;
    if(typeof(url)!=='string'){
        logger.error(util.format('Invalidate url: %s',url));
        return callback(false);
    }
    var redis_cli0 = this.redis_cli0;
    var redis_cli1 = this.redis_cli1;
    var kk = crypto.createHash('md5').update(url).digest('hex');
    redis_cli1.hgetall(kk,function(err,values){
        if(err){return callback(false);}
        if(!values||isEmpty(values)){logger.error(url+' not exists in urlinfo');return callback(false);}

        if(values['trace']){
            var t_url = scheduler.transformLink(url,values['trace']);
            if(t_url!=url){
                logger.debug(util.format('Transform url: %s -> %s',url,t_url));
                return scheduler.checkURL(t_url,interval,callback);
            }
            var traceArr = values['trace'].split(':');
            if(!scheduler.driller_rules[traceArr[2]]||!scheduler.driller_rules[traceArr[2]][traceArr[3]]){
                logger.warn(url+' driller info expired, update it');
                return (function(){
                    var d_r = scheduler.detectLink(url);
                    if(d_r){
                        redis_cli1.hset(kk,'trace','urllib:'+d_r,function(){
                            logger.debug(url+' trace changed '+values['trace']+' -> urllib:'+d_r);
                            scheduler.checkURL(url,interval,callback);
                        });
                    }else{
                        logger.error('no rule match '+url);
                        callback(false);
                    }
                })()
            }
        }

        var status = values['status'];
        var records = values['records']?JSON.parse(values['records']):[];
        var last = values['last']?parseInt(values['last']):0;
        var version = values['version']?parseInt(values['version']):0;
        var type = values['type'];

        if(status!='crawled_failure'&&status!='hit'){
            var real_interval = interval*1000;
            if(status=='crawling'||status=='schedule'){
                real_interval = 60*60*1000;//url request hang up or interrupted, give opportunity to crawl after 60 minutes.
            }
            if(status=='crawled_finish'&&type=='branch'&&version>last){
                real_interval = 0;
                logger.debug(url +' got new version after last crawling');
            }
            if((new Date()).getTime()-last<real_interval){
                logger.debug(util.format('ignore %s, last event time:%s, status:%s',url,last,status));
                return callback(false);
            }else{
                logger.debug('release lock: '+url);
            }
        }

        scheduler.updateLinkState(url,'schedule',false,function(bol){
            if(bol){
                redis_cli0.rpush('queue:scheduled:all',url,function(err,value){
                    if(err){
                        logger.warn('Append '+url+' to queue failure');
                        return callback(false);
                    }else{
                        logger.info('Append '+url+' to queue successful');
                        return callback(true);
                    }
                });
            }else return callback(false);
        });
    });
}

/**
 * update link state to redis db
 * @param link
 * @param state
 */
scheduler.prototype.updateLinkState = function(link,state,version,callback){
    var scheduler = this;
    var urlhash = crypto.createHash('md5').update(link+'').digest('hex');
    this.redis_cli1.hgetall(urlhash,function(err,link_info){
        if(err){logger.error('get state of link('+link+') fail: '+err);return callback(false);}
        if(link_info&&!isEmpty(link_info)){
            var t_record = link_info['records'];
            var records = [];
            if(t_record!=''&&t_record!='[]'){
                try{
                    records = JSON.parse(t_record);
                }catch(e){
                    logger.error(t_record+' JSON parse error: '+e);
                }
            }
            records.push(state);
            var valueDict = {
                'records':JSON.stringify(records),
                'last':(new Date()).getTime(),
                'status':state
            }

            if(version){
                valueDict['version'] = version;//set version
            }

            scheduler.redis_cli1.hmset(urlhash,valueDict,function(err,link_info){
                if(err){
                    logger.error('update state of link('+link+') fail: '+err);
                    return callback(false);
                }
                else {
                    logger.debug('update state of link('+link+') success: '+state);
                    return callback(true);
                }
            });
        }else{
            var trace = scheduler.detectLink(link);
            if(trace!=''){
                trace = 'urllib:' + trace;
                var urlinfo = {
                    'url':link,
                    'trace':trace,
                    'referer':'',
                    'create':(new Date()).getTime(),
                    'records':JSON.stringify([]),
                    'last':(new Date()).getTime(),
                    'status':state
                }
                if(version)urlinfo['version'] = version;//update version
                scheduler.redis_cli1.hmset(urlhash,urlinfo,function(err, value){
                    if (err) {throw(err);return callback(false);}
                    else{
                        logger.debug('save new url info: '+link);
                        return callback(true);
                    }
                });
            }else {
                logger.error(link+' can not match any rules, ignore updating.');
                return callback(false);
            }
        }
    });
}

/**
 * entrance, other module feel free to call this method
 */
scheduler.prototype.start = function(){
    var scheduler = this;
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