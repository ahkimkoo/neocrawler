/**
 * Created by cherokee on 7/8/14.
 */
var settings = require('../settings.json');
var log4js = require('log4js');

log4js.configure({
        "appenders": [
            {
                "type": "dateFile",
                "filename": "logs/shuttle.log",
                "pattern": "-yyyy-MM-dd",
                "alwaysIncludePattern": false
            },
            {
                "type": "console"
            }
        ]
    },
    {cwd: '../'}
);
var logger = log4js.getLogger('shuttle');
logger.setLevel('DEBUG');
settings['logger'] = logger;
settings['port'] = 1985;
var gfw_proxy = new (require('./gfw-proxy.js'))(settings);

gfw_proxy.start();