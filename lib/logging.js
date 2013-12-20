/**
 * logging, log4js based
 */
/**
 * logger constructor
 * @param name
 * @param instance
 * @param level
 * @returns {Logger}
 */
exports.getLogger = function(name,instance,level){
	var log4js = require('log4js'); 
	log4js.configure({
					  "appenders": [
					                {
					                  "type": "dateFile",
					                  "filename": "logs/"+name+"-"+process.pid+".log",
					                  "pattern": "-yyyy-MM-dd",
					                  "alwaysIncludePattern": false
					                },
					                {
					                  "type": "console"
					                }
					              ]
		            }, 
		            {cwd: 'instance/'+instance }
		            );
	var logger = log4js.getLogger(name);
	logger.setLevel(level);
	return logger;
}