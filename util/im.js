const redis = require('redis');
exports.load = (settings) => {
  const instance = settings.instance;
  const rules = require(`../instance/${instance}/rules`);
};
