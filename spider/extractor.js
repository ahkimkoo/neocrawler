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
var querystring = require('querystring');
require('../lib/jsextend.js');

var extractor = function(spiderCore){
    this.spiderCore = spiderCore;
    logger = spiderCore.settings.logger;
    this.cumulative_failure = 0;
}

////report to spidercore standby////////////////////////
extractor.prototype.assembly = function(callback){
    if(callback)callback(null,'done');
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
            if(elem['name']=='img')links.push($(this).attr('src'));
	    else links.push($(this).attr('href'));
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
    if(!domain)return null;
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
            try{
                var the_url = url.resolve(pageurl,link);
                if(the_url!=pageurl)cleaned_link.push(the_url);
            }catch(e){
                logger.error('Url resolve error: '+pageurl+', '+link);
            }

        }
    }
    return arrayUnique(cleaned_link);
}
/**
 * detect link which drill rule matched
 * @param link
 * @returns [alias name,alias]
 */
extractor.prototype.detectLink = function(link){
    var urlobj = url.parse(link);
    var result = [];
    var domain = this.__getTopLevelDomain(urlobj['hostname']);
    if(domain && this.spiderCore.spider.driller_rules[domain]!=undefined){
        var alias = this.spiderCore.spider.driller_rules[domain];
        var domain_rules = Object.keys(alias).sort(function(a,b){return alias[b]['url_pattern'].length - alias[a]['url_pattern'].length});
        for(var i=0; i<domain_rules.length; i++){
            var current_rule = domain_rules[i];
            var url_pattern  = decodeURIComponent(alias[current_rule]['url_pattern']);
            var patt = new RegExp(url_pattern);
            if(patt.test(link)){
              result = [`driller:${this.spiderCore.settings['instance']}:${domain}:${current_rule}`, alias[current_rule]];
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
        if(matched_driller.length>0){
            var driller_lib = 'urllib:' + matched_driller[0];
            var driller_rule = matched_driller[1];
            if(typeof(driller_rule)!='object')driller_rule = JSON.parse(driller_rule);
            if(linkobj[driller_lib]==undefined)linkobj[driller_lib]=[];
            if(driller_rule['id_parameter']&&driller_rule['id_parameter'].length>0){
                var id_parameter = driller_rule['id_parameter'];
                var urlobj = url.parse(link);
                var parameters = querystring.parse(urlobj.query);
                var new_parameters = {};
                for(var x=0;x<id_parameter.length;x++){
                    var param_name = id_parameter[x];
                    if(x==0&&param_name=='#')break;
                    if(parameters.hasOwnProperty(param_name))new_parameters[param_name] = parameters[param_name];
                }
                urlobj.search = querystring.stringify(new_parameters);
                link = url.format(urlobj);
            }
            linkobj[driller_lib].push(link);
        }
    }
    for(var i in linkobj){
        if(linkobj.hasOwnProperty(i)){
            linkobj[i] = arrayUnique(linkobj[i]);
        }
    }
    return linkobj;
}


/**
 * generate drill relation string: page->sub page->sub page
 * @param crawl_info
 * @returns string
 */
extractor.prototype.getDrillRelation = function($,crawl_info){
    //var rule = crawl_info['origin']['drill_relation_rule'];//rule: {"base":"content","mode":"css","expression":"#breadCrumb","pick":"innerText","index":1}
    var rule = this.spiderCore.spider.getDrillerRule(crawl_info['origin']['urllib'],'drill_relation');
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
                new_relation = this.cssSelector($.root(),rule['expression'],rule['pick'],rule['index']);
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
    if(crawl_info['origin']['format']=='binary')return crawl_info;
    var extract_rule = this.spiderCore.spider.getDrillerRule(crawl_info['origin']['urllib'],'extract_rule');

    if(crawl_info['origin']['drill_rules']||extract_rule['rule']){
        var $ = cheerio.load(crawl_info['content']);
    }

    if(crawl_info['origin']['drill_rules']){
        if(crawl_info['drill_link']){
            var drill_link = crawl_info['drill_link'];
        }else{
            var drill_link = this.extract_link($,crawl_info['origin']['drill_rules']);
        }

        var washed_link = this.wash_link(crawl_info['url'],drill_link);
        crawl_info['drill_link'] = this.arrange_link(washed_link);
        if(this.spiderCore.settings['keep_link_relation'])crawl_info['drill_relation'] = this.getDrillRelation($,crawl_info);
    }

    if(extract_rule['rule']&&!isEmpty(extract_rule['rule'])){
        var extracted_data = this.extract_data(crawl_info['url'],crawl_info['content'],extract_rule,null,$.root());
        crawl_info['extracted_data'] = extracted_data;
    }
    return crawl_info;
}
/**
 * extract data
 * @param url
 * @param content
 * @param extract_rule
 * @param uppper_data
 * @param dom
 * @returns {{}}
 */
extractor.prototype.extract_data = function(url,content,extract_rule,uppper_data,dom){
    var data = {};
    var self = this;
    if(extract_rule['category'])data['category'] = extract_rule['category'];
//    if(extract_rule['require'])data['$require'] = extract_rule['require'];
    if(extract_rule['relate'])data['relate'] = uppper_data[extract_rule['relate']];
    for(i in extract_rule['rule']){
        if(extract_rule['rule'].hasOwnProperty(i)){
            var rule = extract_rule['rule'][i];
            var baser = content;
            if(rule['base']==='url')baser = url;
            switch(rule['mode']){
                case 'regex':
                    var tmp_result = this.regexSelector(baser,rule['expression'],rule['index']);
                    data[i] = tmp_result;
                    break;
                case 'xpath':
                    break;
                case 'value':
                    data[i] = rule['expression'];
                    break;
                case 'json':
                    break;
                default://css selector
                    if(dom)baser = dom;
                    else baser = (cheerio.load(content)).root();
                    var pick = rule['pick'];
                    if(rule['subset']){
                        pick = false;
                        (function(k){
                            var result_arr = [];
                            var tmp_result = self.cssSelector(baser,rule['expression'],pick,rule['index']);
                            if(tmp_result){
                                tmp_result.each(function(x, elem) {
                                    var sub_dom = tmp_result.eq(x);
                                    result_arr.push(self.extract_data(url,content,rule['subset'],data,sub_dom));
                                });
                            }
                            if(!isEmpty(result_arr))data[k] = result_arr;
                        })(i);
                    }else{
                        try{
                            var tmp_result = this.cssSelector(baser,rule['expression'],pick,rule['index']);
                            if(tmp_result&&!isEmpty(tmp_result))data[i] = tmp_result;
                        } catch(e){
                            logger.error(url + ' extract field '+ i + ' error:'+e);
                        }
                    }

            }
            }
    }
    if(extract_rule['require']){
        var lacks = [];
        for(var c=0;c<extract_rule['require'].length;c++){
            var key = extract_rule['require'][c];
            if(typeof(key)==='object'){
                var sublack = self.checksublack(key,data);
                if(sublack.length>0)lacks = lacks.concat(sublack);
            }else{
                if(!data[key]){
                    lacks.push(key);
                    logger.warn(key + ' not found in '+ url + ' extracted data');
                }
            }
        }
        if(!isEmpty(lacks)){
            logger.error(url + ' extracted data lacks of '+lacks.join(','));
            self.spiderCore.spider.urlReportRedis.zadd('incomplete:data:url',(new Date()).getTime(),url,function(err,result){
                //nothing
            });
            if('data_lack_alert' in self.spiderCore.spider_extend)self.spiderCore.spider_extend.data_lack_alert(url,lacks);
        }else{
            self.spiderCore.spider.urlReportRedis.zrem('incomplete:data:url',url,function(err,result){
                //nothing
            });
        }
    }
    return data;
}
//check sublack
extractor.prototype.checksublack = function(keys,data){
    var sublackarr = [];
    for(var x=0;x<keys.length;x++){
        if(!data[keys[x]]){
            sublackarr.push(keys[x]);
            logger.warn(keys[x] + ' not found in '+ url + ' extracted data');
        }
    }
    if(sublackarr.length===keys.length)return sublackarr;
    else return [];
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
//    logger.debug('css expression: '+expression);
    if(!index)index=1;
    var real_index = parseInt(index) - 1;
    //if(real_index<0)real_index=0;
    var tmp_val = $.find(expression);
    if(!pick)return tmp_val;
    if(typeof(tmp_val)==='object'){
        if(real_index>=0){
            var val = tmp_val.eq(real_index);
            return this.cssSelectorPicker(val,pick);
        }else{
            var arrayResult = [];
            for(var i=0;i<tmp_val.length;i++){
                var val = tmp_val.eq(i);
                arrayResult.push(this.cssSelectorPicker(val,pick));
            }
            if(arrayResult.length==1)arrayResult = arrayResult[0];
            return arrayResult;
        }
    }else {
        var val = tmp_val;
        return this.cssSelectorPicker(val,pick);
    }
}
/**
 * pick value/attribute from element
 * @param val
 * @param pick
 * @returns {*}
 */
extractor.prototype.cssSelectorPicker = function(val,pick){
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
    //if(result)result = result.replace(/[\r\n\t]/g, "").trim();
    if(result)result = result.trim();
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
    var index = parseInt(index);
    if(index==0)index=1;
    var expression = new RegExp(expression,"ig");
    if(index>0){
        var matched = expression.exec(content);
        if(matched&&matched.length>index)return matched[index];
    }else{
        var arr = [],matched;
        while (matched = expression.exec(content))
            arr.push(matched[1]);
        return arr;
    }

}

extractor.prototype.validateContent = function(crawl_info){
    var self = this;
    var result = true;
    var statusCode = parseInt(crawl_info['statusCode']);
    var limitation = 500;
    if(crawl_info['origin']['format']=='binary')limitation = 20;
    if(statusCode===200){
        if(crawl_info['content'].length<limitation){
            logger.error(util.format('Too little content: %s, length:%s',crawl_info['url'],crawl_info['content'].length));
            result = false;
        }
        if(crawl_info['origin']['validation_keywords']){
            for(var i =0;i<crawl_info['origin']['validation_keywords'].length;i++){
                var keyword = crawl_info['origin']['validation_keywords'][i];
                if(crawl_info['content'].indexOf(keyword)<0){
                    logger.error(util.format('%s lacked keyword: %s',crawl_info['url'],keyword));
                    result = false;break;
                }
            }
        }
    }else{
        logger.error(util.format('url:%s, status code: %s',crawl_info['url'],statusCode));
        if(statusCode>300)result=false;//30x,40x,50x
    }
    if(self.spiderCore.settings['to_much_fail_exit']){
        self.cumulative_failure +=  result?-1:1
        if(self.cumulative_failure<0)self.cumulative_failure = 0;
        if(self.cumulative_failure>self.spiderCore.settings['spider_concurrency']*1.5){
            logger.fatal('too much fail, exit. '+self.cumulative_failure);
            process.exit(1);
        }
    }
    return result;
}

module.exports = extractor;
