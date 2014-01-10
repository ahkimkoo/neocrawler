/**
 * Created by malcolm on 1/9/14.
 */

Monitor = function() {
    var mysql = require('mysql');
    var settings = global.settings['statistic_mysql_db'];
    var connection = mysql.createConnection({
        host    : settings[0],
        port    : settings[1],
        user    : settings[3],
        password: settings[4],
        database: settings[2]
    });
    this.connection = connection;

    var heads = ["Date", "Request", "Response", "Exception-40x", "Exception-50x",
                 "Exception-other", "Invalidation", "Cost(AVG)"];
    this.heads = heads;

    var fields = ['tdate', 'request', 'response', 'exception40x', 'exception50x',
                  'exception_oth', 'invalidation', 'cost_avg'];
    this.fields = fields;
};

Monitor.prototype.isEmpty = function(str) {
    if (str == undefined) return true;
    if (str.trim() == '') return true;
    return false;
};


Monitor.prototype.query = function(sql, callback) {
    this.connection.query(sql, callback);
};

Monitor.prototype.dateFormat = function(date) {
    return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
}

var monitor = new Monitor();

exports.index = function(req, res) {
    console.log('statistic monitor reqired');
    var result = {};

    var domain_callback = function(err, rows) {
        if (err) {
            console.log('domains require failed: ' + err);
            res.render('monitor/index', { err: err });
            return;
        }

        var domains = [];
        for (var i = 0; i < rows.length; ++i) {
            domains.push(rows[i].domain);
        }
        result.domains = domains;
        result.err     = false;
        result.heads   = monitor.heads;
        res.render('monitor/index', result);
    };

    monitor.query('select distinct domain as domain from dataflow', domain_callback);
};

exports.search = function(req, res) {
    console.log('statistic monitor search require');
    var date   = req.query['date'];
    var domain = req.query['domain'];
    var result = {};


    var callback = function(err, rows) {
        if (err) {
            console.log('statistic data require failed: ' +  err);
            res.json('monitor/index', {err: err});
            return;
        }

        var result = [];
        var fields = monitor.fields;
        for (var i = 0; i < rows.length; ++i) {
            var row = rows[i];
            var cols = [];
            for (var j = 0; j < fields.length; ++j) {
                cols.push(row[fields[j]]);
            }
            cols[0] = monitor.dateFormat(cols[0]);
            result.push(cols);
        }
        res.json({aaData: result});
    };

    var sql = 'select * from dataflow where 1 = 1 ';
    if (!monitor.isEmpty(date)) {
        sql = sql + ' and tdate = Date("' + date + '")';
    }

    if (!monitor.isEmpty(domain)) {
        sql = sql + ' and domain = "' + domain + '"';
    }
    monitor.query(sql, callback);
};
