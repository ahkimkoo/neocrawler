/**
 * ux crawler entrance 
 */
////log setting////////////////////////////////////////////////////////////////////
var logging = require('./lib/logging.js'); 
////arguments parse///////////////////////////////////////////////////////////////
var userArgv = require('optimist')
.usage('Usage: $0 -i [instance name] -a [crawl|test|config|proxy]  -p [num] -l[url] -h')
.options('i', {
        'alias' : 'instance',
        'default' : 'spaceux',
        'describe' : 'Specify a instance',
        'demand' : true
    })
.options('a', {
        'alias' : 'action',
        'default' : 'crawl',
        'describe' : 'Specify a action',
        'demand' : true
    })
.options('p', {
        'alias' : 'port',
        'default' : 2013,
        'describe' : 'Specify a service port, for config service and proxy router'
    })
.options('l', {
    'alias' : 'link',
    'default' : '',
    'describe' : 'Specify a url to test crawling'
})
.options('h', {
        'alias' : 'help',
        'describe' : 'Help infomation'
    });

var options = userArgv.argv;
if(options['h'])userArgv.showHelp();
var settings = require('./instance/'+options['i']+'/'+'settings.json');
////crawling action///////////////////////////////////////////////////////////
var crawling = function(){
	var logger = logging.getLogger('crawling',options['i'],'DEBUG');
    settings['logger'] = logger;
    settings['instance'] = options['i'];
    var spider = new (require('./spider'))(settings);

    spider.start();
}
////proxy Service////////////////////////////////////////////////////////////
var proxyService = function(){
	var logger = logging.getLogger('config-service',options['i'],'DEBUG');
	settings['logger'] = logger;
	settings['instance'] = options['i'];
	settings['port'] = parseInt(options['p']);
	var proxyRouter = new (require('./proxyrouter'))(settings);
	
	proxyRouter.start();
}
////config service////////////////////////////////////////////////////////////
var configService = function(){
	var logger = logging.getLogger('config-service',options['i'],'DEBUG');
	settings['logger'] = logger;
	settings['instance'] = options['i'];
	settings['port'] = parseInt(options['p']);
	var webConfig = new(require('./webconfig'))(settings);
	
	webConfig.start();	
}
////test url/////////////////////////////////////////////////////////////////
var testUrl = function(){
    if(options['l']!=''){
        var logger = logging.getLogger('crawling-testing',options['i'],'DEBUG');
        settings['logger'] = logger;
        settings['instance'] = options['i'];
        settings['test'] = true;
        var spider = new (require('./spider'))(settings);

        spider.test(options['l']);
    }
}
////route/////////////////////////////////////////////////////////////////////
switch(options['a']){
case 'crawl':
	crawling();
	break;
case 'proxy':
	proxyService();
	break;
case 'config':
	configService();
	break;
case 'test':
    testUrl();
    break;
default:
	userArgv.showHelp();
}