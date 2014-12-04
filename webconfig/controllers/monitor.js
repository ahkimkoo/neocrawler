/**
 * Created by malcolm on 1/9/14.
 */

var myredis = require('../../lib/myredis.js');
var async = require('async');
var ruledb = null;
var infodb = null;
var reportdb = null;

var dbtype = 'redis';
if(global.settings['use_ssdb'])dbtype = 'ssdb';

myredis.createClient(
    global.settings['driller_info_redis_db'][0],
    global.settings['driller_info_redis_db'][1],
    global.settings['driller_info_redis_db'][2],
    dbtype,
    function(err,cli){
        ruledb = cli;
    });


myredis.createClient(
    global.settings['url_info_redis_db'][0],
    global.settings['url_info_redis_db'][1],
    global.settings['url_info_redis_db'][2],
    dbtype,
    function(err,cli){
        infodb = cli;
    });


myredis.createClient(
    global.settings['url_report_redis_db'][0],
    global.settings['url_report_redis_db'][1],
    global.settings['url_report_redis_db'][2],
    dbtype,
    function(err,cli){
        reportdb = cli;
    });

/**
 * get date string
 * @returns {string} 20140928
 * @private
 */
var __getDateStr = function(){
    var d = new Date();
    return ''+ d.getFullYear() + (d.getMonth()>8?d.getMonth()+1:'0'+(d.getMonth()+1)) + (d.getDate()>9?d.getDate():'0'+d.getDate());
}

exports.daily = function(req, res) {
    var date   = req.query['date'];
    if(!date)date = __getDateStr();
    var result = {};
    var total = {};

    reportdb.hgetall('count:'+date,function(err,hashes){
        for(var i in hashes){
            if(hashes.hasOwnProperty(i)){
                var spilited = i.split(':');
                var colname = spilited[0];
                var domain = spilited[1];
                if(!result[domain])result[domain] = {};
                result[domain][colname] = hashes[i];
                if(!total[colname])total[colname] = parseInt(hashes[i]);
                else total[colname] += parseInt(hashes[i]);
            }
        }
        res.render('monitor/daily', {'result':result,'date':date,'total':total});
    });
};

exports.linkdb = function(req, res) {
    var total_linkcount = 0;
    var linkcount = {};
    var scheduledcount = 0;
    var rulelastchanged = 0;
    var linkinfodbsize = 0;

    async.series([
        function(callback){
            ruledb.keys('urllib:driller:*',function(err,keys){
                if(!err&&keys){
                    var c = 0;
                    async.whilst(function(){
                        return c<keys.length;
                    },function(cb){
                        var itm = keys[c++];
                        ruledb.llen(itm,function(err,size){
                            if(!err&&size){
                                linkcount[itm] = size;
                                total_linkcount += size;
                                cb();
                            }else cb(err);
                        });
                    },function(err){
                        callback();
                    });
                }else callback()
            });
        },
        function(callback){
            ruledb.llen('queue:scheduled:all',function(err,size){
                if(!err&&size)scheduledcount = size;
                callback();
            });
        },
        function(callback){
            ruledb.get('updated:driller:rule',function(err,val){
                if(!err&&val)rulelastchanged = val;
                callback();
            });
        },
        function(callback){
            infodb.dbsize(function(err,size){
                if(!err&&size)linkinfodbsize = size;
                callback();
            });
        }
    ],function(err){
        res.render('monitor/linkdb', {'total_linkcount':total_linkcount,'linkcount':linkcount,'scheduledcount':scheduledcount,'rulelastchanged':rulelastchanged,'linkinfodbsize':linkinfodbsize});
    })
};

exports.chart = function(req, res) {
    var domain   = req.query['domain'];
    var sdays   = req.query['days']||'30';
    var days = parseInt(sdays);

    var nd = new Date();
    var nl = nd.getTime();
    var date_arr = [];
    var crawl_arr = [];
    var retry_arr = [];
    var fail_arr = [];
    var lack_arr = [];
    var save_arr = [];
    var finish_arr = [];

    var index = days;
    async.whilst(
        function(){
            return index >= 0;
        },
        function(callback){
            var td = new Date(nl-86400000*index--);
            var dstr = '';
            dstr += td.getFullYear();
            var month = td.getMonth()+1;
            if(month<10)dstr += '0' + month;
            else dstr += month;
            if(td.getDate()<10)dstr += '0' + td.getDate();
            else dstr += td.getDate();
            date_arr.push(month+'-'+td.getDate());
            reportdb.hgetall('count:'+dstr,function(err,hashes){
                crawl_arr.push(hashes['crawl:'+domain]?parseInt(hashes['crawl:'+domain]):0);
                retry_arr.push(hashes['retry:'+domain]?parseInt(hashes['retry:'+domain]):0);
                fail_arr.push(hashes['fail:'+domain]?parseInt(hashes['fail:'+domain]):0);
                lack_arr.push(hashes['lack:'+domain]?parseInt(hashes['lack:'+domain]):0);
                save_arr.push(hashes['save:'+domain]?parseInt(hashes['save:'+domain]):0);
                finish_arr.push(hashes['finish:'+domain]?parseInt(hashes['finish:'+domain]):0);
                callback();
            });
        },
        function(err){
            res.render('monitor/chart',{'domain':domain,'days':days,'date_arr':date_arr,'crawl_arr':crawl_arr,'retry_arr':retry_arr,'fail_arr':fail_arr,'lack_arr':lack_arr,'save_arr':save_arr,'finish_arr':finish_arr});
        }
    );
}