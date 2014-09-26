{assert} = require 'chai'
async = require 'async'
ByteBuffer = require '../node_modules/protobufjs/node_modules/bytebuffer'
config = require './test_config'

blanket = (require 'blanket')()



describe 'hbase', () ->
	before (done) ->
		rows = testRows.map (row) ->
			row.row

		client.mdelete testTable, rows, () ->
			matchesBlanket = (path) -> path.match /node_modules\/blanket/
			runningTestCoverage = Object.keys(require.cache).filter(matchesBlanket).length > 0
			if runningTestCoverage
				require('require-dir')("#{__dirname}/../lib", {recurse: true, duplicates: true})

			done()

	@_timeout = config.timeout


	# create pre-splitted table with versions
	# hbase org.apache.hadoop.hbase.util.RegionSplitter node-hbase-test-table HexStringSplit -c 10 -f cf1
	# echo "alter 'node-hbase-test-table', {NAME=>'cf1', VERSIONS => 5}" | hbase shell


	testTable = config.testTable
	testRows = [
			row: '1'
			cf: 'cf1'
			col: 'col1'
			val: 'val1'
		,
			row: '5'
			cf: 'cf1'
			col: 'col2'
			val: 'val2'
		,
			row: '9'
			cf: 'cf1'
			col: 'col3'
			val: 'val3'
		,
			row: 'a'
			cf: 'cf1'
			col: 'col4'
			val: 'val4'
	]

	tCf = testRows[0].cf
	tRow = testRows[0].row
	tCol = testRows[0].col
	tVal = testRows[0].val

	randomValue = 'lkjhgfdsa'
	hbase = require '../index.coffee'

	client = hbase
		zookeeperHosts: config.zookeeperHosts
		zookeeperRoot: config.zookeeperRoot


	putRow = (row, cf, col, val, ts, cb) ->
		if typeof ts is 'function'
			cb = ts
			ts = null

		put = new hbase.Put row
		put.add cf, col, val, ts

		client.put testTable, put, (err, res) ->
			assert.notOk err, "put returned an error: #{err}"
			assert.equal res.processed, yes, "put wasn't processed"
			getRow row, cf, col, val, ts, cb

	getRow = (row, cf, col, val, ts, cb) ->
		if typeof ts is 'function'
			cb = ts
			ts = null

		get = new hbase.Get row
		get.addColumn cf, col

		client.get testTable, get, (err, res) ->
			assert.notOk err, "get returned an error: #{err}"
			assert.equal res.row, row, "rowKey doesn't match"
			assert.equal res.columns[0].family.toString(), cf, "columnFamily doesn't match"
			assert.equal res.columns[0].qualifier.toString(), col, "qualifier doesn't match"
			assert.equal res.columns[0].timestamp.toString(), ts.toString(), "timestamp doesn't match" if ts

			if typeof val is 'object'
				assert.equal res.columns[0].value.toString(), val.toString(), "value doesn't match"
			else
				assert.equal res.columns[0].value, val, "value doesn't match"

			cb null, res

	deleteRow = (row, cb) ->
		del = new hbase.Delete row

		client.delete testTable, del, (err, res) ->
			assert.notOk err, "delete returned an error: #{err}"
			assert.equal res.processed, yes, "delete wasn't processed"

			rowDoesNotExist row, cb

	rowDoesNotExist = (row, cb) ->
		get = new hbase.Get row

		client.get testTable, get, (err, res) ->
			assert.notOk err, "get returned an error: #{err}"
			assert.notOk res, "row #{row} exists"
			cb()

	describe 'put & mput', () ->
		afterEach (done) ->
			rows = testRows.map (row) ->
				row.row

			client.mdelete testTable, rows, done

		it 'should put single row', (done) ->
			putRow tRow, tCf, tCol, tVal, done

		it 'should put multiple rows via simple array', (done) ->
			puts = []
			puts = testRows.map (row) ->
				o =
					row: row.row
				o["#{row.cf}:#{row.col}"] = row.val
				o

			client.mput testTable, puts, (err, res) ->
				assert.notOk err, "mput returned an error: #{err}"
				done()

		it 'should put multiple rows via array of Put objects', (done) ->
			puts = testRows.map (row) ->
				put = new hbase.Put row.row
				put.add row.cf, row.col, row.val
				put

			client.mput testTable, puts, (err, res) ->
				assert.notOk err, "mput returned an error: #{err}"
				done()

		it 'should checkAndPut', (done) ->
			putRow tRow, tCf, tCol, tVal, () ->
				put = new hbase.Put tRow
				put.add tCf, tCol, randomValue

				client.checkAndPut testTable, tRow, tCf, tCol, tVal, put, (err, res) ->
					assert.notOk err, "checkAndPut returned an error: #{err}"
					assert.equal res.processed, yes, "checkAndPut wasn't processed"
					getRow tRow, tCf, tCol, randomValue, done

	describe 'get & mget', () ->
		before (done) ->
			puts = testRows.map (row) ->
				put = new hbase.Put row.row
				put.add row.cf, row.col, row.val
				put

			client.mput testTable, puts, done

		after (done) ->
			rows = testRows.map (row) ->
				row.row

			client.mdelete testTable, rows, done

		it 'should get single row', (done) ->
			getRow tRow, tCf, tCol, tVal, done

		it 'should get single row with invalid maxVersions', (done) ->
			get = new hbase.Get tRow
			get.setMaxVersions 0

			client.get testTable, get, (err, res) ->
				assert.notOk err, "get returned an error: #{err}"
				assert.equal res.row, tRow, "rowKey doesn't match"
				done()

		it 'should get multiple rows via simple array', (done) ->
			gets = testRows.map (row) ->
				row.row

			client.mget testTable, gets, (err, res) ->
				assert.notOk err, "mget returned an error: #{err}"
				assert.equal res.length, testRows.length, "mget didn't return expected number of rows"
				done()

		it 'should get multiple rows via array of Get objects', (done) ->
			gets = testRows.map (row) ->
				new hbase.Get row.row

			client.mget testTable, gets, (err, res) ->
				assert.notOk err, "mget returned an error: #{err}"
				assert.equal res.length, testRows.length, "mget didn't return expected number of rows"
				done()

		it 'should get multiple versions', (done) ->
			tests = [
				(cb) ->
					putRow tRow, tCf, tCol, tVal, cb
				(r, cb) ->
					putRow tRow, tCf, tCol, tVal + '1', cb
				(r, cb) ->
					putRow tRow, tCf, tCol, tVal + '2', cb
				(r, cb) ->
					get = new hbase.Get tRow
					get.setMaxVersions 3

					client.get testTable, get, (err, row) ->
						assert.notOk err, "get returned an error: #{err}"
						assert.equal row.cols["#{tCf}:#{tCol}"][0].value.toString(), tVal + '2', "latest version value doesn't match"
						assert.equal row.cols["#{tCf}:#{tCol}"][1].value.toString(), tVal + '1', "2nd latest version value doesn't match"
						assert.equal row.cols["#{tCf}:#{tCol}"][2].value.toString(), tVal, "oldest version value doesn't match"
						cb()
				(cb) ->
					del = new hbase.Delete tRow
					del.deleteColumns tCf, tCol

					client.delete testTable, del, (err, res) ->
						assert.notOk err, "delete returned an error: #{err}"
						assert.equal res.processed, yes, "delete wasn't processed"
						cb()
				(cb) ->
					rowDoesNotExist tRow, cb
			]

			async.waterfall tests, done

		it 'should get with timeRange', (done) ->
			ts = null
			tests = [
				(cb) ->
					putRow tRow, tCf, tCol, tVal, (err, row) ->
						ts = row.cols["#{tCf}:#{tCol}"].timestamp
						cb()
				(cb) ->
					putRow tRow, tCf, tCol, tVal + '1', cb
				(r, cb) ->
					ts1 = ts2 = ts
					ts1--
					ts2++

					get = new hbase.Get tRow
					get.setTimeRange ts1, ts2

					client.get testTable, get, (err, row) ->
						assert.notOk err, "get returned an error: #{err}"
						assert.equal row.row, tRow, "rowKey doesn't match"
						assert.equal row.cols["#{tCf}:#{tCol}"].value, tVal, "value doesn't match"
						cb()
				(cb) ->
					deleteRow tRow, cb
			]

			async.waterfall tests, done

	describe 'delete & mdelete', () ->
		beforeEach (done) ->
			puts = testRows.map (row) ->
				put = new hbase.Put row.row
				put.add row.cf, row.col, row.val
				put

			client.mput testTable, puts, done

		after (done) ->
			rows = testRows.map (row) ->
				row.row

			client.mdelete testTable, rows, done

		it 'should delete row', (done) ->
			deleteRow testRows[1].row, done

		it 'should checkAndDelete row', (done) ->
			putRow tRow, tCf, tCol, randomValue, () ->
				del = new hbase.Delete tRow

				client.checkAndDelete testTable, tRow, tCf, tCol, randomValue, del, (err, res) ->
					assert.notOk err, "checkAndDelete returned an error: #{err}"
					assert.equal res.processed, yes, "checkAndDelete wasn't processed"

					get = new hbase.Get tRow

					client.get testTable, get, (err, res) ->
						assert.notOk err, "get returned an error: #{err}"
						assert.notOk res, "row #{tRow} exists"
						done()

		it 'should deleteColumn & deleteColumns', (done) ->
			tests = [
				(cb) ->
					putRow tRow, tCf, tCol, tVal, cb
				(r, cb) ->
					putRow tRow, tCf, tCol, tVal + '1', cb
				(r, cb) ->
					putRow tRow, tCf, tCol, tVal + '2', cb
				(r, cb) ->
					del = new hbase.Delete tRow
					del.deleteColumn tCf, tCol

					client.delete testTable, del, (err, res) ->
						assert.notOk err, "delete returned an error: #{err}"
						assert.equal res.processed, yes, "delete wasn't processed"
						cb()
				(cb) ->
					getRow tRow, tCf, tCol, tVal + '1', cb
				(r, cb) ->
					del = new hbase.Delete tRow
					del.deleteColumns tCf, tCol

					client.delete testTable, del, (err, res) ->
						assert.notOk err, "delete returned an error: #{err}"
						assert.equal res.processed, yes, "delete wasn't processed"
						cb()
				(cb) ->
					rowDoesNotExist tRow, cb
			]

			async.waterfall tests, done

		it 'should deleteFamily & deleteFamilies', (done) ->
			ts = null
			tests = [
				(cb) ->
					putRow tRow, tCf, tCol, tVal, (err, row) ->
						ts = row.cols["#{tCf}:#{tCol}"].timestamp
						cb()
				(cb) ->
					putRow tRow, tCf, tCol, tVal + '1', (++ts).toString(), cb
				(r, cb) ->
					putRow tRow, tCf, tCol, tVal + '2', (++ts).toString(), cb
				(r, cb) ->
					del = new hbase.Delete tRow
					del.deleteFamilyVersion tCf, ts

					client.delete testTable, del, (err, res) ->
						assert.notOk err, "delete returned an error: #{err}"
						assert.equal res.processed, yes, "delete wasn't processed"
						cb()
				(cb) ->
					getRow tRow, tCf, tCol, tVal + '1', (--ts).toString(), cb
				(r, cb) ->
					del = new hbase.Delete tRow
					del.deleteFamily tCf

					client.delete testTable, del, (err, res) ->
						assert.notOk err, "delete returned an error: #{err}"
						assert.equal res.processed, yes, "delete wasn't processed"
						cb()
				(cb) ->
					rowDoesNotExist tRow, cb
			]

			async.waterfall tests, done

		it 'should delete multiple rows via simple array', (done) ->
			rows = testRows.map (row) ->
				row.row

			client.mdelete testTable, rows, (err, res) ->
				assert.notOk err, "mdelete returned an error: #{err}"
				assert.equal res.length, 0, "mdelete should return empty row"

				client.mget testTable, rows, (err, res) ->
					assert.notOk err, "mget returned an error: #{err}"
					assert.equal res.length, 0, "not all rows were deleted"
					done()

		it 'should delete multiple rows via array of Delete objects', (done) ->
			rows = testRows.map (row) ->
				row.row

			dels = testRows.map (row) ->
				new hbase.Delete row.row

			client.mdelete testTable, dels, (err, res) ->
				assert.notOk err, "mdelete returned an error: #{err}"
				assert.equal res.length, 0, "mdelete should return empty row"

				client.mget testTable, rows, (err, res) ->
					assert.notOk err, "mget returned an error: #{err}"
					assert.equal res.length, 0, "not all rows were deleted"
					done()

	describe 'scanner', () ->
		before (done) ->
			puts = testRows.map (row) ->
				put = new hbase.Put row.row
				put.add row.cf, row.col, row.val
				put

			client.mput testTable, puts, done

		after (done) ->
			rows = testRows.map (row) ->
				row.row

			client.mdelete testTable, rows, done

		it 'should scan the table', (done) ->
			scan = client.getScanner testTable

			async.eachSeries [0..testRows.length], (i, cb) ->
				if i is testRows.length
					scan.next (err, row) ->
						assert.notOk err, "scan.next returned an error: #{err}"
						assert.equal Object.keys(row), 0, "last scan should return empty object"
						cb()
				else
					scan.next (err, row) ->
						assert.notOk err, "scan.next returned an error: #{err}"
						assert.equal row.row, testRows[i].row, "rowKey doesn't match"
						cb()
			, done

		it 'should stop scanning after closing the scanner', (done) ->
			scan = client.getScanner testTable

			scan.next (err, row) ->
				assert.notOk err, "scan.next returned an error: #{err}"
				assert.equal row.row, tRow, "rowKey doesn't match"

				scan.close()
				scan.close()
				scan.next (err, row) ->
					assert.notOk err, "scan.next returned an error: #{err}"
					assert.equal Object.keys(row), 0, "closed scanner should return empty object"
					done()

		it 'should scan the table with startRow and stopRow', (done) ->
			scan = client.getScanner testTable, '5', '6'

			scan.next (err, row) ->
				assert.notOk err, "scan.next returned an error: #{err}"
				assert.equal row.row, testRows[1].row, "rowKey doesn't match"

				scan.next (err, row) ->
					assert.notOk err, "scan.next returned an error: #{err}"
					assert.equal Object.keys(row), 0, "should return empty object"
					done()

		it 'should report invalid filter for scan', (done) ->
			scan = client.getScanner testTable
			try
				scan.setFilter nonexistingFilter: yes
				done 'did not detect invalid filter'
			catch e
				assert.equal e.message, 'Invalid filter NonexistingFilter', "invalid error message"
				done()

		it 'should scan the table with filter', (done) ->
			scan = client.getScanner testTable
			scan.setFilter columnPrefixFilter: prefix: testRows[2].col

			scan.next (err, row) ->
				assert.notOk err, "scan.next returned an error: #{err}"
				assert.equal row.row, testRows[2].row ,"rowKey doesn't match"
				assert.equal row.cols["#{testRows[2].cf}:#{testRows[2].col}"].value, testRows[2].val, "value doesn't match"

				scan.next (err, row) ->
					assert.notOk err, "scan.next returned an error: #{err}"
					assert.equal Object.keys(row), 0, "scan.next should return empty object"
					done()

		it 'should scan the table with filterList', (done) ->
			scan = client.getScanner testTable
			fl = new hbase.FilterList 'MUST_PASS_ONE', columnPrefixFilter: prefix: testRows[2].col
			scan.setFilter fl

			scan.next (err, row) ->
				assert.notOk err, "scan.next returned an error: #{err}"
				assert.equal row.row, testRows[2].row, "rowKey doesn't match"
				assert.equal row.cols["#{testRows[2].cf}:#{testRows[2].col}"].value, testRows[2].val, "value doesn't match"

				scan.next (err, row) ->
					assert.notOk err, "scan.next returned an error: #{err}"
					assert.equal Object.keys(row), 0, "scan.next should return empty object"
					done()

		it 'should scan the table and convert result to array', (done) ->
			scan = client.getScanner testTable

			scan.toArray (err, res) ->
				assert.notOk err, "scan.toArray returned an error: #{err}"

				for i, row of testRows
					assert.equal res[i].row, testRows[i].row, "rowKey doesn't match"
					assert.equal res[i].cols["#{testRows[i].cf}:#{testRows[i].col}"].value, testRows[i].val, "value doesn't match"

				done()

		it 'should scan the table with filterList consisting of multiple filterLists', (done) ->
			scan = client.getScanner testTable

			f1 =
				singleColumnValueFilter:
					columnFamily: 'cf1'
					columnQualifier: 'col2'
					compareOp: 'EQUAL'
					comparator:
						substringComparator:
							substr: '2'
					filterIfMissing: yes
					latestVersionOnly: yes

			f2 =
				singleColumnValueFilter:
					columnFamily: 'cf1'
					columnQualifier: 'col3'
					compareOp: 'EQUAL'
					comparator:
						substringComparator:
							substr: '3'
					filterIfMissing: yes
					latestVersionOnly: yes

			fl1 = new hbase.FilterList
			fl2 = new hbase.FilterList
			fl3 = new hbase.FilterList 'MUST_PASS_ONE'

			fl1.addFilter f1
			fl2.addFilter f2

			fl3.addFilter fl1
			fl3.addFilter fl2

			scan.setFilter fl3

			scan.toArray (err, res) ->
				assert.notOk err, "scan.toArray returned an error: #{err}"

				assert.equal res[0].row, testRows[1].row, "rowKey doesn't match"
				assert.equal res[0].cols["#{testRows[1].cf}:#{testRows[1].col}"].value, testRows[1].val, "value doesn't match"

				assert.equal res[1].row, testRows[2].row, "rowKey doesn't match"
				assert.equal res[1].cols["#{testRows[2].cf}:#{testRows[2].col}"].value, testRows[2].val, "value doesn't match"
				done()

	describe 'increment', () ->
		it 'should increment & incrementColumnValue', (done) ->
			inc = 4
			b = new ByteBuffer 8
			b.writeLong 65
			b = b.toBuffer()

			tests = [
				(cb) ->
					putRow tRow, tCf, tCol, b, cb
				(r, cb) ->
					increment = new hbase.Increment tRow
					assert.equal increment.getRow(), tRow, "rowKey doesn't match"
					increment.add tCf, tCol, inc

					client.increment testTable, increment, (err, res) ->
						assert.notOk err, "increment returned an error: #{err}"
						val = res.result.cell[0].value.toBuffer()
						assert.equal hbase.utils.bufferCompare(val, b), inc, "value wasn't incremented"
						cb()
				(cb) ->
					client.incrementColumnValue testTable, tRow, tCf, tCol, inc, (err, res) ->
						assert.notOk err, "incrementColumnValue returned an error: #{err}"
						val = res.result.cell[0].value.toBuffer()
						assert.equal hbase.utils.bufferCompare(val, b), inc * 2, "value wasn't incremented"
						cb()
				(cb) ->
					deleteRow tRow, cb
			]

			async.waterfall tests, done






