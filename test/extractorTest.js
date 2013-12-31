/**
 * Created by james on 13-12-31.
 */
var http = require('http');
var iconv = require('iconv-lite');
var BufferHelper = require('bufferhelper');
var assert = require('assert');
var util = require('util');
require('../lib/jsextend.js');

var logging = require('../lib/logging.js');
var logger = logging.getLogger('testing','spaceux','DEBUG');
var settings = require('../instance/spaceux/settings.json');
settings['instance'] = 'spaceux';
settings['logger'] = logger;
var spider = new (require('../spider'))(settings);
//spider.start();


var dirllRelationTest1 = function(){
    var url = 'http://www.amazon.cn/s/ref=sr_ex_n_1?rh=n%3A2127215051&bbn=2127215051&ie=UTF8&qid=1387944813';
    http.get(url,function(res){
        var bufferHelper = new BufferHelper();
        res.on('data', function (chunk) {
            bufferHelper.concat(chunk);
        });
        res.on('end',function(){
            var html = iconv.decode(bufferHelper.toBuffer(),'utf-8');
            var cheerio = require('cheerio');
            var $ = cheerio.load(html);
            var result = spider.extractor.cssSelector($,'#breadCrumb','innerText',1);
            assert.equal(result.trim(),'食品','dill relation extract failure.');
        });
    });
}

var dirllRelationTest2 = function(){
    var url = 'http://www.amazon.cn/s/ref=sr_ex_n_1?rh=n%3A2127215051&bbn=2127215051&ie=UTF8&qid=1387944813';
    http.get(url,function(res){
        var bufferHelper = new BufferHelper();
        res.on('data', function (chunk) {
            bufferHelper.concat(chunk);
        });
        res.on('end',function(){
            var html = iconv.decode(bufferHelper.toBuffer(),'utf-8');
            var cheerio = require('cheerio');
            var $ = cheerio.load(html);
            var result = spider.extractor.regexSelector(url,'.*?qid=(\\d+).*',1);
            var expected = '1387944813';
            assert(result,'extract none');
            assert.equal(result.trim(),expected,util.format('dill relation extract failure.expect: %s, actual: ',expected,result.trim()));
        });
    });
}

dirllRelationTest1();
dirllRelationTest2();