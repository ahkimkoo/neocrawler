var log = function(msg){
  print(msg);
}
log("Add index: uid");
db.info.ensureIndex({"uid":1});
log("Add index: nickname");
db.info.ensureIndex({"nickname":1});

log("Fetch all records");
db.info.find({"domain":"jiayuan.com"}).forEach(function(doc){
  log("checking duplidated records for "+doc["uid"]);
  db.info.remove({"uid":doc["uid"],"_id":{"$ne":doc['_id']}});
});