/**
 * Created by malcolm on 1/9/14.
 */

var myredis = require('../../lib/myredis.js');
var reportdb = null;

var dbtype = 'redis';
if(global.settings['use_ssdb'])dbtype = 'ssdb';

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
    return ''+ d.getFullYear() + (d.getMonth()>9?d.getMonth()+1:'0'+(d.getMonth()+1)) + (d.getDate()>9?d.getDate():'0'+d.getDate());
}

exports.daily = function(req, res) {
    var date   = req.query['date'];
    if(!date)date = __getDateStr();
    var result = {};

    reportdb.hgetall('count:'+date,function(err,hashes){
        for(var i in hashes){
            if(hashes.hasOwnProperty(i)){
                var spilited = i.split(':');
                var colname = spilited[0];
                var domain = spilited[1];
                if(!result[domain])result[domain] = {};
                result[domain][colname] = hashes[i];
            }
        }
        res.render('monitor/daily', {'result':result,'date':date});
    });
};
