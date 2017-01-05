const elasticsearch = require('elasticsearch');
const config = require('../config');
console.log(config.eshost);
const client = new elasticsearch.Client({
  host: config.eshost,
  log: 'info'
});

const index = 'sindex';
const type = 'page';




exports.update = (item, _new, doc) => {
  const id = item.link;
  client.index({
    index,
    type,
    id,
    body: item,
  }, function (error, response) {
    if(error){
      console.error(error);
      console.error(doc);
    }
  });
};



client.search({
  index,
}, function (error, response) {
  console.log(response.hits.total);
});
