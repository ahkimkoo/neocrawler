
process.env.TEST_ENV ?= 'default'


config =
	wision:
		zookeeperHosts: ['192.168.57.101']
		zookeeperRoot: '/hbase'
		timeout: 10000
		testTable: 'node-hbase-test-table'
	default:
		zookeeperHosts: ['localhost']
		zookeeperRoot: '/hbase'
		timeout: 10000
		testTable: 'node-hbase-test-table'

module.exports = config[process.env.TEST_ENV]

