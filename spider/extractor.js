/**
 * Created by james on 13-11-22.
 * extract middleware
 */
/**
 * extract link
 * @param crawl_info
 */
var cheerio = require('cheerio')
var url =  require("url");
require('../lib/jsextend.js');

var extractor = function(spiderCore){
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;
}

////report to spidercore standby////////////////////////
extractor.prototype.assembly = function(){
    this.spiderCore.emit('standby','extractor');
}

/**
 * According rules extracting all links from html string
 * @param content
 * @param rules
 * @returns {Array}
 */
extractor.prototype.extract_link = function(content,rules){
    $ = cheerio.load(content);
    var links = [];
    for(var i=0;i<rules.length;i++){
        $(rules[i]).each(function(i, elem) {
            links.push($(this).attr('href'));
        });
    }
    return links;
}
/**
 * get top level domain
 * www.baidu.com -> baidu.com
 * @param domain
 * @returns string
 * @private
 */
extractor.prototype.__getTopLevelDomain = function(domain){
    var arr = domain.split('.');
    if(arr.length<=2)return domain;
    else return arr.slice(1).join('.');
}

/**
 * url resolv
 * @param pageurl
 * @param links
 * @returns {Array}
 */
extractor.prototype.wash_link = function(pageurl,links){
    //url resolve
    var cleaned_link = [];
    for(var i=0;i<links.length;i++){
        if(!links[i])continue;
        var link = links[i].trim();
        if(!(link.startsWith('#')||link.startsWith('javascript')||link.startsWith('void('))){
            cleaned_link.push(url.resolve(pageurl,link));
        }
    }
    return cleaned_link;
}

extractor.prototype.detectLink = function(link){
    var urlobj = url.parse(link);
    var result = '';
    var domain = this.__getTopLevelDomain(urlobj['hostname']);
    if(this.spiderCore.spider.driller_rules[domain]!=undefined){
        var alias = this.spiderCore.spider.driller_rules[domain];
        for(a in alias){
            var url_pattern  = decodeURIComponent(alias[a]['url_pattern']);
            var patt = new RegExp(url_pattern);
            if(patt.test(link)){
                result = 'driller:'+domain+':'+a;
                break;
            }
        }

    }
    return result;
}


extractor.prototype.arrange_link = function(links){
    var linkobj = {};
    for(var i=0;i<links.length;i++){
        var link = links[i];
        var matched_driller = this.detectLink(link);
        if(matched_driller!=''){
            matched_driller = 'urllib:' + matched_driller;
            if(linkobj[matched_driller]==undefined)linkobj[matched_driller]=[];
            linkobj[matched_driller].push(link);
        }
    }
    return linkobj;
}

extractor.prototype.extract = function(crawl_info){
    if(crawl_info['drill_link']){
        var drill_link = crawl_info['drill_link'];
    }else{
        var drill_link = this.extract_link(crawl_info['content'],crawl_info['origin']['drill_rules']);
    }

    var washed_link = this.wash_link(crawl_info['url'],drill_link);
    crawl_info['drill_link'] = this.arrange_link(washed_link);
    return crawl_info;
}

module.exports = extractor;