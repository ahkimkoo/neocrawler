/**
 * ux crawler entrance
 */
const config = require('config');
////log setting////////////////////////////////////////////////////////////////////
var log4js = require('log4js');
////arguments parse///////////////////////////////////////////////////////////////
var userArgv = require('optimist')
  .usage('Usage: $0 -i [instance name] -a [crawl|test|config|proxy|schedule]  -p [num] -l[url] -h')
  .options('i', {
    'alias': 'instance',
    'default': 'pengtouba',
    'describe': 'Specify a instance',
    'demand': true
  })
  .options('a', {
    'alias': 'action',
    'default': 'crawl',
    'describe': 'Specify a action[crawl|test|config|proxy|schedule]',
    'demand': true
  })
  .options('p', {
    'alias': 'port',
    'default': 2013,
    'describe': 'Specify a service port, for config service and proxy router'
  })
  .options('l', {
    'alias': 'link',
    'default': '',
    'describe': 'Specify a url to test crawling'
  })
  .options('h', {
    'alias': 'help',
    'describe': 'Help infomation'
  });

var options = userArgv.argv;
if (options['h']) {
  userArgv.showHelp();
  process.exit();
}

//region Assemble Settings
const redisSettingFromConfig = config.get('redis') || {};
const crawlerSettingFromConfig = config.get('crawler') || {};
const hbaseSettingFromConfig = config.get('hbase') || {};
const settingsFromInstance = require('./instance/' + options['i'] + '/' + 'settings.json');
const settings = {};
settings['instance'] = options['i'];
// redis
// settings['driller_info_redis_db'] = redisSettingFromConfig['drillerInfo'] || settingsFromInstance['url_info_redis_db'];
// settings['url_info_redis_db'] = redisSettingFromConfig['urlInfo'] || settingsFromInstance['url_info_redis_db'];
// settings["url_report_redis_db"] = redisSettingFromConfig['urlReport'] || settingsFromInstance['url_report_redis_db'];
// settings["proxy_info_redis_db"] = redisSettingFromConfig['proxyInfo'] || settingsFromInstance['proxy_info_redis_db'];
settings['driller_info_redis_db'] = redisSettingFromConfig['drillerInfo'];
settings['url_info_redis_db'] = redisSettingFromConfig['urlInfo'];
settings["url_report_redis_db"] = redisSettingFromConfig['urlReport'];
settings["proxy_info_redis_db"] = redisSettingFromConfig['proxyInfo'];
// crawler
settings["use_proxy"] = crawlerSettingFromConfig['use_proxy'] !== null ? crawlerSettingFromConfig['use_proxy'] : settingsFromInstance['use_proxy'];
settings["proxy_router"] = crawlerSettingFromConfig['proxy_router'] || settingsFromInstance["proxy_router"];
settings["download_timeout"] = crawlerSettingFromConfig['download_timeout'] || settingsFromInstance["download_timeout"];
settings["check_driller_rules_interval"] = crawlerSettingFromConfig["check_driller_rules_interval"] || settingsFromInstance["check_driller_rules_interval"];
settings["spider_concurrency"] = crawlerSettingFromConfig['spider_concurrency'] || settingsFromInstance["spider_concurrency"];
settings["spider_request_delay"] = crawlerSettingFromConfig['spider_request_delay'] || settingsFromInstance["spider_request_delay"];
settings["schedule_interval"] = crawlerSettingFromConfig['schedule_interval'] || settingsFromInstance["schedule_interval"];
settings["schedule_quantity_limitation"] = crawlerSettingFromConfig['schedule_quantity_limitation'] || settingsFromInstance["schedule_quantity_limitation"];
settings["download_retry"] = crawlerSettingFromConfig['download_retry'] || settingsFromInstance["download_retry"];
settings["log_level"] = crawlerSettingFromConfig['log_level'] || settingsFromInstance["log_level"];
// settings["use_ssdb"] = crawlerSettingFromConfig['use_ssdb'] || settingsFromInstance["use_ssdb"];
settings["to_much_fail_exit"] = crawlerSettingFromConfig['to_much_fail_exit'] || settingsFromInstance["to_much_fail_exit"];
settings["keep_link_relation"] = crawlerSettingFromConfig['keep_link_relation'] || settingsFromInstance["keep_link_relation"];
// hbase
settings["save_content_to_hbase"] = crawlerSettingFromConfig['save_content_to_hbase'] !== null ? crawlerSettingFromConfig['save_content_to_hbase'] : settingsFromInstance["save_content_to_hbase"];
settings["crawled_hbase_conf"] = hbaseSettingFromConfig['hosts'] || settingsFromInstance["crawled_hbase_conf"];
settings["crawled_hbase_table"] = hbaseSettingFromConfig['crawledTable'] || settingsFromInstance["crawled_hbase_table"];
settings["crawled_hbase_bin_table"] = hbaseSettingFromConfig['crawledBinTable'] || settingsFromInstance["crawled_hbase_bin_table"];
// settings["statistic_mysql_db"] = settingsFromInstance["statistic_mysql_db"];
//endregion

////crawling action///////////////////////////////////////////////////////////
var crawling = function () {
  const logger = log4js.getLogger(`spider${options['i']}`);
  logger.setLevel(settings['log_level']);
  settings['logger'] = logger;
  var spider = new (require('./spider'))(settings);
  spider.start();
};

////proxy Service////////////////////////////////////////////////////////////
var proxyService = function () {
  var logger = log4js.getLogger(`proxy-service${options['i']}`);
  settings['logger'] = logger;
  settings['port'] = parseInt(options['p']);
  var proxyRouter = new (require('./proxyrouter'))(settings);

  proxyRouter.start();
}
////config service////////////////////////////////////////////////////////////
var configService = function () {
  var logger = log4js.getLogger(`config-service${options['i']}`);
  settings['logger'] = logger;
  settings['port'] = parseInt(options['p']);
  var webConfig = new (require('./webconfig'))(settings);

  webConfig.start();
}
////scheduler///////////////////////////////////////////////////////////////
var schedule = function () {
  var logger = log4js.getLogger(`schedule${options['i']}`);
  settings['logger'] = logger;
  var scheduler = new (require('./scheduler'))(settings);

  scheduler.start();
}

////test url/////////////////////////////////////////////////////////////////
var testUrl = function () {
  if (options['l'] != '') {
    var logger = logging.getLogger(`crawling-testing${options['i']}`);
    settings['logger'] = logger;
    settings['test'] = true;
    settings['use_proxy'] = false;
    var spider = new (require('./spider'))(settings);

    spider.test(options['l']);
  }
}

////route/////////////////////////////////////////////////////////////////////
switch (options['a']) {
  case 'crawl':
    crawling();
    break;
  case 'proxy':
    proxyService();
    break;
  case 'config':
    configService();
    break;
  case 'schedule':
    schedule();
    break;
  case 'test':
    testUrl();
    break;
  default:
    userArgv.showHelp();
}