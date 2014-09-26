node-hbase
==========
[![Build Status](https://travis-ci.org/falsecz/node-hbase.svg?branch=master)](https://travis-ci.org/falsecz/node-hbase)
[![Dependency Status](https://david-dm.org/falsecz/node-hbase.svg)](https://david-dm.org/falsecz/node-hbase)
[![License](https://img.shields.io/badge/license-Apache_2-red.svg)](https://github.com/falsecz/node-hbase/blob/master/LICENSE.txt)

CoffeeScript HBase Implementation with protobuf support based on https://github.com/alibaba/node-hbase-client/


### Supported HBase versions
* [x] 0.96.x
* [x] 0.98.x


### Features
* [x] get
* [x] put
* [x] delete
* [x] mget
* [x] mput
* [x] mdelete
* [x] checkAndPut
* [x] checkAndDelete
* [x] scan:
	 * [√] filter
	 * [√] filterList
* [x] increment
* [x] incrementColumnValue
* [ ] getRowOrBefore
* [ ] mutateRow
* [ ] append



### Create a hbase client through zookeeper
```coffeescript
hbase = require "node-hbase"

client = hbase
	zookeeperHosts: ["localhost"] # required
	zookeeperRoot: "/hbase"
	rootRegionZKPath: "/meta-region-server"
	rpcTimeout: 30000
	pingTimeout: 30000
	callTimeout: 5000
```

### put
##### `put table, put, callback`
```coffeescript
put = new hbase.Put rowKey
put.add cf, qualifier, value

client.put table, put, (err, res) ->
	console.log arguments
```

### get
##### `get table, get, callback`
```coffeescript
get = new hbase.Get rowKey

client.get table, get, (err, res) ->
	console.log arguments
```

### delete
##### `delete table, delete, callback`
```coffeescript
del = new hbase.Delete rowKey

client.delete table, del, (err, res) ->
	console.log arguments
```

### mput
##### `mput table, arrayOfPutObjects, callback`
##### `mput table, arrayOfObjects, callback`
```coffeescript
put1 = new hbase.Put rowKey1
put1.add cf1, qualifier1, value1

put2 = new hbase.Put rowKey2
put2.add cf2, qualifier2, value2

client.mput table, [put1, put2], (err, res) ->
	console.log arguments
```
```coffeescript
put1 =
	row: rowKey1
put1["#{cf1}:#{qualifier1}"] = value1

put2 =
	row: rowKey2
put2["#{cf2}:#{qualifier2}"] = value2

client.mput table, [put1, put2], (err, res) ->
	console.log arguments
```

### mget
##### `mget table, arrayOfGetObjects, callback`
##### `mget table, arrayOfObjects, callback`
```coffeescript
get1 = new hbase.Get rowKey1
get2 = new hbase.Get rowKey2

client.get table, [get1, get2], (err, res) ->
	console.log arguments
```
```coffeescript
client.get table, [rowKey1, rowKey2], (err, res) ->
	console.log arguments
```

### mdelete
##### `mdelete table, arrayOfDeleteObjects, callback`
##### `mdelete table, arrayOfObjects, callback`
```coffeescript
delete1 = new hbase.Delete rowKey1
delete2 = new hbase.Delete rowKey2

client.delete table, [delete1, delete2], (err, res) ->
	console.log arguments
```
```coffeescript
client.delete table, [rowKey1, rowKey2], (err, res) ->
	console.log arguments
```

### scan
##### `scanner = getScanner table, startRow, stopRow`
##### `scanner.setFilter filter`
##### `scanner.next callback`
##### `scanner.each function, callback`
##### `scanner.toArray callback`
##### `scanner.close()`
```coffeescript
scan = client.getScanner table

scan.next (err, row) ->
	console.log arguments
```
```coffeescript
scan = client.getScanner table, startRow, stopRow

scan.next (err, row) ->
	console.log arguments
```
```coffeescript
scan = client.getScanner table
scan.setFilter columnPrefixFilter: prefix: columnPrefix

scan.next (err, row) ->
	console.log arguments
```
```coffeescript
scan = client.getScanner table

filter1 =
	singleColumnValueFilter:
		columnFamily: cf1
		columnQualifier: qualifier1
		compareOp: "EQUAL"
		comparator:
			substringComparator:
				substr: value1
		filterIfMissing: yes
		latestVersionOnly: yes

filter2 =
	singleColumnValueFilter:
		columnFamily: cf2
		columnQualifier: qualifier2
		compareOp: "EQUAL"
		comparator:
			substringComparator:
				substr: value2
		filterIfMissing: yes
		latestVersionOnly: yes

filterList1 = new hbase.FilterList
filterList2 = new hbase.FilterList
filterList3 = new hbase.FilterList "MUST_PASS_ONE"

filterList1.addFilter f1
filterList2.addFilter f2

filterList3.addFilter filterList1
filterList3.addFilter filterList2

scan.setFilter filterList3
scan.toArray (err, res) ->
	console.log arguments
```
```coffeescript
scan = client.getScanner table

scan.toArray (err, res) ->
	console.log arguments
```
```coffeescript
scan = client.getScanner table

scan.each (err, row) ->
	return unless row # no more rows
	# do something with row synchronously
```
```coffeescript
scan = client.getScanner table

scan.each (err, row, done) ->
	return unless row # no more rows
	# do something with row asynchronously
	done()
```
```coffeescript
scan = client.getScanner table

scan.each (err, row, done) ->
	# do something with row asynchronously
	done()
, (err) ->
	# error or no more rows
	console.log err if err
```

### checkAndPut
##### `checkAndPut table, rowKey, cf, qualifier, value, putObject, callback`
```coffeescript
put = new hbase.Put rowKey1
put.add cf1, qualifier1, value1

client.checkAndPut table, rowKey2, cf2, qualifier2, value2, put, (err, res) ->
	console.log arguments
```

### checkAndDelete
##### `checkAndDelete table, rowKey, cf, qualifier, value, deleteObject, callback`
```coffeescript
del = new hbase.Put rowKey1

client.checkAndDelete table, rowKey2, cf2, qualifier2, value2, del, (err, res) ->
	console.log arguments
```

### increment
##### `increment table, incrementObject, callback`
```coffeescript
increment = new hbase.Increment rowKey
increment.add cf1, qualifier1, incrementValue1
increment.add cf2, qualifier2, incrementValue2

client.increment table, increment, (err, res) ->
	console.log arguments
```

### incrementColumnValue
##### `incrementColumnValue table, rowKey, cf, qualifier, value, callback`
```coffeescript
client.incrementColumnValue table, rowKey, cf, qualifier, incrementValue, (err, res) ->
	console.log arguments
```


## License

node-hbase is made available under the Apache License, version 2.0
