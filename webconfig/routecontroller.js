// map request with request handler 

exports.mapRoute = function(app, prefix) {
	prefix = '/' + prefix;
	var prefixObj = require('./controllers' + prefix);
	// index
	app.get(prefix, prefixObj.index);
	// search
	app.post(prefix + '/search', prefixObj.search);	
	// add
	app.get(prefix + '/new', prefixObj.new);
	// show
	app.get(prefix + '/:id', prefixObj.show);
	// create
	app.post(prefix + '/create', prefixObj.create);
	// edit
	app.get(prefix + '/:id/edit', prefixObj.edit);
	// update
	app.put(prefix + '/:id', prefixObj.update);
	// destroy
	app.del(prefix + '/:id', prefixObj.destroy);
};