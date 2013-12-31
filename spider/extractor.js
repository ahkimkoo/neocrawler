/**
 * Created by james on 13-11-22.
 * extract middleware
 */
/**
 * extract link
 * @param crawl_info
 */
var cheerio = require('cheerio')
var util = require('util');
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
extractor.prototype.extract_link = function($,rules){
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
    return cleaned_link.unique();
}
/**
 * detect link which drill rule matched
 * @param link
 * @returns {string}
 */
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

/**
 * arrange link array.
 * @param links
 * @returns {{}}
 */
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
/**
 * extract value base expression
 * @param $
 * @param expression
 * @param pick
 * @param index
 * @returns {*}
 */
extractor.prototype.cssSelector = function($,expression,pick,index){
    logger.debug('css expression: '+expression);
    if(!index)index=1;
    var real_index = parseInt(index) - 1;
    if(real_index<0)real_index=0;
    var tmp_val = $(expression);
    if(!pick)return tmp_val;
    if(typeof(tmp_val)==='object'){
        var val = tmp_val.eq(real_index);
    }else var val = tmp_val;

    var result;
    if(pick.startsWith('@')){
        result = val.attr(pick.slice(1));
    }
    else{
        switch(pick.toLowerCase()){
            case 'text':
            case 'innertext':
                result = val.text();
                break;
            case 'html':
            case 'innerhtml':
                result = val.html();
                break;
        }
    }
    result = result.replace(/[\r\n\t]/g, "").trim();
    return result;
}
/**
 * return matched group base expression
 * @param content
 * @param expression
 * @param index
 * @returns {*}
 */
extractor.prototype.regexSelector = function(content,expression,index){
    logger.debug('regex expression: '+expression);
    var index = parseInt(index);
    if(index<1)index=1;
    var expression = new RegExp(expression,"ig");
    var matched = expression.exec(content);
    if(matched&&matched.length>index)return matched[index];
}

/**
 * generate drill relation string: page->sub page->sub page
 * @param crawl_info
 * @returns string
 */
extractor.prototype.getDrillRelation = function($,crawl_info){
    var rule = crawl_info['origin']['drill_relation_rule'];//rule: {"base":"content","mode":"css","expression":"#breadCrumb","pick":"innerText","index":1}
    var origin_relation = crawl_info['origin']['drill_relation'];
    if(!origin_relation)origin_relation = '*';
    var new_relation = '*';
    if(rule){
        switch(rule['mode']){
            case 'regex':
                if(rule['base']==='url'){
                    new_relation = this.regexSelector(crawl_info['url'],rule['expression'],rule['index']);
                }else{
                    new_relation = this.regexSelector(crawl_info['content'],rule['expression'],rule['index']);
                }
                break;
            case 'css':
            default:
                new_relation = this.cssSelector($,rule['expression'],rule['pick'],rule['index']);
                break;
        }
    }
    return util.format('%s->%s',origin_relation,new_relation);
}

/**
 * extractor: for now , just extract links
 * @param crawl_info
 * @returns {*}
 */
extractor.prototype.extract = function(crawl_info){
    if(crawl_info['origin']['drill_rules']){
        var $ = cheerio.load(crawl_info['content']);
        if(crawl_info['drill_link']){
            var drill_link = crawl_info['drill_link'];
        }else{
            var drill_link = this.extract_link($,crawl_info['origin']['drill_rules']);
        }

        var washed_link = this.wash_link(crawl_info['url'],drill_link);
        crawl_info['drill_link'] = this.arrange_link(washed_link);
        crawl_info['drill_relation'] = this.getDrillRelation($,crawl_info);
    }
    return crawl_info;
}

module.exports = extractor;