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

var arrangeLinkText = function() {
    spider.assembly();
    spider.spider.refreshDrillerRules();
    setTimeout(function(){
        var links = [
            'http://www.amazon.cn/Toblerone%E7%91%9E%E5%A3%AB%E4%B8%89%E8%A7%92%E9%BB%91%E5%B7%A7%E5%85%8B%E5%8A%9B%E5%90%AB%E8%9C%82%E8%9C%9C%E5%8F%8A%E5%B7%B4%E6%97%A6%E6%9C%A8%E7%B3%9650g-5%E5%85%83%E8%B6%85%E5%80%BC%E6%8D%A2%E8%B4%AD%E4%B8%AD-%E4%BC%98%E6%83%A0%E7%A0%815HUANGOU/dp/B003NNUIA8/ref=sr_1_1?s=grocery&ie=UTF8&qid=1388994448&sr=1-1'
        ];
        var arranged_links = spider.extractor.arrange_link(links);
        assert.equal(arranged_links['urllib:driller:amazon.cn:detailpage'][0],'http://www.amazon.cn/Toblerone%E7%91%9E%E5%A3%AB%E4%B8%89%E8%A7%92%E9%BB%91%E5%B7%A7%E5%85%8B%E5%8A%9B%E5%90%AB%E8%9C%82%E8%9C%9C%E5%8F%8A%E5%B7%B4%E6%97%A6%E6%9C%A8%E7%B3%9650g-5%E5%85%83%E8%B6%85%E5%80%BC%E6%8D%A2%E8%B4%AD%E4%B8%AD-%E4%BC%98%E6%83%A0%E7%A0%815HUANGOU/dp/B003NNUIA8/ref=sr_1_1');
    },2000);
}

//dirllRelationTest1();
//dirllRelationTest2();
arrangeLinkText();