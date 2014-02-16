// map request with request handler
exports.mapRoute = function(app) {
	//prefix = '/' + prefix;

	prefix_rule = '/rule';
	prefix_proxy = '/proxy';
    prefix_monitor = '/monitor';

	var prefixRuleObj = require('./controllers' + prefix_rule);
	var prefixProxyObj = require('./controllers' + prefix_proxy);
    var prefixMonitorObj = require('./controllers' + prefix_monitor);

	// index
	app.get(prefix_rule, prefixRuleObj.index);
	
	// search
	app.post(prefix_rule + '/search', prefixRuleObj.search);	
	// add
	app.get(prefix_rule + '/new', prefixRuleObj.new);
	// show
	app.get(prefix_rule + '/:id', prefixRuleObj.show);
	// create
	app.post(prefix_rule + '/create', prefixRuleObj.create);
	// edit
	app.get(prefix_rule + '/:id/edit', prefixRuleObj.edit);
	// update
	app.post(prefix_rule + '/upsert', prefixRuleObj.update);
	// destroy
	app.del(prefix_rule + '/:id', prefixRuleObj.destroy);
	
/////////////////////////////////////////////////////////////////////
	// Proxy index 
	app.get(prefix_proxy, prefixProxyObj.index);
	// Proxy index 
	app.get(prefix_proxy + '/index', prefixProxyObj.index);	
	// Proxy edit 
	app.get(prefix_proxy + "/new", prefixProxyObj.new);
	// Proxy create 
	app.post(prefix_proxy + "/create", prefixProxyObj.create);
	// Proxy destroy 
	app.get(prefix_proxy + "/:host/:key", prefixProxyObj.destroy);

/////////////////////////////////////////////////////////////////////////
    app.get(prefix_monitor, prefixMonitorObj.index);

    app.get(prefix_monitor + "/search", prefixMonitorObj.search);
};