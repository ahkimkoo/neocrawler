const Redis = require('ioredis');
const config = require('config');


const drillerInfoRedis = new Redis(config.get('redis.drillerInfo'));
const urlInfoRedis = new Redis(config.get('redis.urlInfo'));
const urlReportRedis = new Redis(config.get('redis.urlReport'));
const proxyInfoRedis = new Redis(config.get('redis.proxyInfo'));

for (let redis_cli of [drillerInfoRedis, urlInfoRedis, urlReportRedis, proxyInfoRedis]) {
  redis_cli.hlist = function (name, callback) {
    redis_cli.keys(name, callback);
  };
  redis_cli.hclear = function (name, callback) {
    redis_cli.del(name, callback);
  };
  redis_cli.zlen = function (name, callback) {
    redis_cli.zcount(name, 0, (new Date()).getTime(), callback);
  };
  redis_cli.zlist = function (name, callback) {
    redis_cli.keys(name, callback);
  };
  redis_cli.qlist = function (name, callback) {
    redis_cli.keys(name, callback);
  };
  redis_cli.close = function () {
    redis_cli.quit();
  };
}

module.exports = {
  drillerInfoRedis,
  urlInfoRedis,
  urlReportRedis,
  proxyInfoRedis
};