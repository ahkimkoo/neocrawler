/**
 * ux crawler entrance 
 */
////log setting////////////////////////////////////////////////////////////////////
var logging = require('./lib/logging.js'); 
////arguments parse///////////////////////////////////////////////////////////////
var userArgv = require('optimist')
.usage('Usage: $0 -i [instance name] -a [crawl|test|config|proxy]  -p [num] -h')
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
        'default' : 5000,
        'describe' : 'Specify a service port, for config service and proxy router'
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
	logger.debug(new Date());
}
////proxy Service////////////////////////////////////////////////////////////
var proxyService = function(){
	var logger = logging.getLogger('config-service',options['i'],'DEBUG');
	settings['logger'] = logger;
	settings['port'] = parseInt(options['p']);
	var proxyRouter = new (require('./proxyrouter'))(settings);
	
	proxyRouter.run();
}
////config service////////////////////////////////////////////////////////////
var configService = function(){
	
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
	configService()
	break;
default:
	userArgv.showHelp();
}