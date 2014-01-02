/**
 * Created by james on 13-11-22.
 * phantom js bridge
 */

var system = require('system');
var page = require('webpage').create();

//command signal defined
var CMD_SIGNAL_CRAWL_SUCCESS = 1;
var CMD_SIGNAL_CRAWL_FAIL = 3;
var CMD_SIGNAL_NAVIGATE_EXCEPTION = 2;
var retryTimer = null;

////phantomjs client identify
var pid = system.pid;
////caller interactive////////////////////////////////////////////////////////////////////////
var sendToCaller = function(msg){
    //console.log(JSON.stringify(msg));
    system.stdout.writeLine(JSON.stringify(msg)+'#^_^#');
}
////user agent////////////////////////////////////////////////////////////////////////////////
page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36';
page.viewportSize = { width: 1280, height: 5000 };
////argv//////////////////////////////////////////////////////////////////////////////////////////
var drill_count = 0;
if(system.args.length<2)phantom.exit();
try{
var origin_urlinfo = JSON.parse(system.args[1]);
}catch(e){
    sendToCaller({'signal':CMD_SIGNAL_NAVIGATE_EXCEPTION,'message':'js parse fail',"message":e,'jsonstr':system.args[1]});
}

////set cookie///////////////////////////////////////////////////////////////////////////////////
for(var i=0;i<origin_urlinfo['cookie'].length;i++){
    try{
        phantom.addCookie(origin_urlinfo['cookie'][i]);
    }catch(e){
        //pass
    }
}

////page event////////////////////////////////////////////////////////////////////////////////////
page.onResourceRequested = function (req) {
    //you can ignore css here
};

page.onResourceReceived = function (res) {
    if (res.stage === 'start') {
    }
    else if (res.stage === 'end') {
        if(res.url===page.url){
            page.status = res.status;
            for(var s=0;s<res.headers.length;s++){
                if(res.headers[s]['name']==='remoteproxy'){
                    page.remoteProxy = res.headers[s]['value'];
                    break;
                }
            }
        }
        if(page.url==="about:blank"){
            page.status = res.status;
        }
    }
};

page.onInitialized = function() {
    //nothing
};

page.onUrlChanged = function(targetUrl) {
    //pass
};

page.onResourceError = function(resourceError) {
    if(resourceError.url===page.url){
        sendToCaller({
            'signal':CMD_SIGNAL_CRAWL_FAIL,
            'message':'Unable to load resource',
            "url":resourceError.url,
            "errorCode":resourceError.errorCode,
            "description":resourceError.errorString
        });
    }
};

page.onLoadStarted  = function(status) {
    page.startTime = new Date();
    page.status = null;
    if(retryTimer)clearTimeout(retryTimer);
};

page.onLoadFinished = function(status) {
    if (status !== 'success') {
        sendToCaller({'signal':CMD_SIGNAL_CRAWL_FAIL,'message':'Open page failed',"url":page.url});
    } else {
        page.endTime = new Date();
        workAfterLoadFinish(0,0);
    }

};

page.onNavigationRequested = function(url, type, willNavigate, main) {
    page.customHeaders = {
        "client_pid": pid,
        "page": url
    };
}

var workAfterLoadFinish = function(drill_retry,navigateretry){
    var injected = false;
    if(origin_urlinfo['inject_jquery']&&(drill_retry+navigateretry)==0){
        injected = page.injectJs("jquery-1.10.2.min.js");
    }
/*
    var point = page.evaluate(function(rules){
        var bt = document.querySelector('ul.tb-tabbar li:nth-child(2) a.tb-tab-anchor');
        $('ul.tb-tabbar li:nth-child(2) a.tb-tab-anchor').click();
        return true;
    },origin_urlinfo['drill_rules']);
*/
    var js_result = [];
    if(origin_urlinfo['script'].length>0){
        var script = drill_count<origin_urlinfo['script'].length?origin_urlinfo['script'][drill_count]:origin_urlinfo['script'][origin_urlinfo['script'].length-1];
        if(script)js_result = jsExec(script);
    }

    var drill_link = [];
    if(origin_urlinfo['drill_rules'].length>0){
        var drill_link = page.evaluate(function(rules){
            var jsexec_result = [];
            for(var i=0;i<rules.length;i++){
                var doms = document.querySelectorAll(rules[i]);
                for(var x=0;x<doms.length;x++){
                    jsexec_result.push(doms[x].getAttribute('href'));
                }
            }
            return jsexec_result;
        },origin_urlinfo['drill_rules']);
        if(drill_link==undefined)drill_link=[];
    }


    if(drill_link.length<1&&drill_retry<30){
        retryTimer = setTimeout(function(){workAfterLoadFinish(++drill_retry,navigateretry);},200);
        return;
    }else{
        if(retryTimer)clearTimeout(retryTimer);
    }

    var result = {
        "signal":CMD_SIGNAL_CRAWL_SUCCESS,
        "content":origin_urlinfo['type']==="node"?page.content:'',
        "remote_proxy":page.remoteProxy,
        "cost":page.endTime-page.startTime,
        "inject_jquery":injected,
        "js_result":js_result,
        "drill_link":drill_link,
        "drill_count":drill_count,
        "cookie":page.cookies,
        "url":page.url,
        "statusCode":page.status,
        "origin":origin_urlinfo
    };

    if(drill_count<origin_urlinfo['stoppage']-1&&origin_urlinfo['navigate_rule'].length>0&&origin_urlinfo['navigate_rule'][0]!=''){
        var navigate_rule = drill_count<origin_urlinfo['navigate_rule'].length?origin_urlinfo['navigate_rule'][drill_count]:origin_urlinfo['navigate_rule'][origin_urlinfo['navigate_rule'].length-1];
        //page.injectJs("webpatch.js");
        var button = page.evaluate(function(navigate_rule) {
            var tbt = document.querySelector(navigate_rule);
            return tbt;
        },navigate_rule);

        if(button.offsetLeft==undefined&&navigateretry<30){
            retryTimer = setTimeout(function(){workAfterLoadFinish(drill_retry,++navigateretry);},200);
            return;
        }else{
            if(retryTimer)clearTimeout(retryTimer);
            sendToCaller(result);

            page_test_action();

            drill_count++;
//            var fs = require('fs');
//            var ipath = origin_urlinfo['ipath'];
//            fs.write(ipath+'/debug-info'+drill_count+'.txt',JSON.stringify(button),'w');
        }

        if(!button)sendToCaller({'signal':CMD_SIGNAL_NAVIGATE_EXCEPTION,'message':'navigate fail',"url":page.url});
        clickbutton(button.offsetLeft+1, button.offsetTop+1,500,0);
    }else{
        page_test_action();
        sendToCaller(result);
        phantom.exit();
    }
}

var page_test_action = function(){
    if(origin_urlinfo['test']!=undefined){
        var fs = require('fs');
        var ipath = origin_urlinfo['ipath'];
        page.render(ipath+'/debug-page'+drill_count+'.png');
        fs.write(ipath+'/debug-browser-page'+drill_count+'.html',page.content,'w');
    }
}

var clickbutton = function(x,y,repeat,retry){
    page.sendEvent('click',x,y);
    if(retry<10){
        if(repeat>0){
            setTimeout(function(){clickbutton(x,y,repeat,++retry)},repeat);
        }
    }else{
        if(retryTimer)clearTimeout(retryTimer);
        sendToCaller({'signal':CMD_SIGNAL_NAVIGATE_EXCEPTION,'message':'navigate fail',"url":page.url});
    }
}

var jsExec= function(commad){
    var xr = page.evaluate(function(commad){
        var jsexec_result = [];
        commad = 'try{'+commad+'}catch(e){}';
        eval(commad);
        return jsexec_result;
    },commad);
    return xr;
}

////act//////////////////////////////////////////////////////////////////////////////////////
page.open(origin_urlinfo['url'], function (status) {});
/*
var url = 'http://ju.taobao.com/?spm=1.6659421.754904973.2.ALtBmk';
var script = "jsexec_result = $.makeArray($('.category li a span').text())";
var urlinfo = {"url":url,"type":"branch","referer":"http://www.taobao.com","jshandle":true,"inject_jquery":true,"script":script,"navigate_rules":[]}
openUrl(urlinfo);
*/
