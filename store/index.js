// const config = require('../config');
// const co = require('co');
// const mongodb = require('mongodb');
//
// const MongoClient = mongodb.MongoClient;
//
// const mhost = config.host;
// let _db;
// function _connect() {
//   if (_db) {
//     return _db;
//   }
//   _db = co(function* c() {
//     return yield MongoClient.connect(mhost);
//   });
//   return _db;
// }
//
// exports.update = function(item) {
//   const filter = {
//     link: item.link,
//   }
//   return co(function* c() {
//     const db = yield _connect();
//     const collection = db.collection('page');
//     return yield collection.findOneAndUpdate(
//       filter, { $setOnInsert: item }, { upsert: true });
//   });
// };

const es = require('./elastic');

exports.update = es.update;
