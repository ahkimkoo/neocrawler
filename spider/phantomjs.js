/**
 * Created by james on 13-11-22.
 * phantom js bridge
 */

var system = require('system');
var page = require('webpage').create();

//command signal defined
var CMD_SIGNAL_EXIT = -1;
var CMD_SIGNAL_STATUS = 0;
var CMD_SIGNAL_EXCEPTION = 1;
var CMD_SIGNAL_OPENURL = 10;
var CMD_SIGNAL_JQEXEC = 11;
var CMD_SIGNAL_CRAWL_SUCCESS = 20;
var CMD_SIGNAL_JQEXEC_SUCCESS = 21;

////page event////////////////////////////////////////////////////////////////////////////////////
page.onLoadStarted = function () {
    page.startTime = new Date();
};

page.onResourceRequested = function (req) {
    //you can ignore css here
};

page.onResourceReceived = function (res) {
    if (res.stage === 'start') {
        //pass
    }
    if (res.stage === 'end') {
        if(res.url===page.address){
            for(var s=0;s<res.headers.length;s++){
                if(res.headers[s]['name']==='remoteProxy'){
                    page.remoteProxy = res.headers[s]['value'];
                    break;
                }
            }
        }

    }
};

page.onInitialized = function() {
    page.customHeaders = {};
};

////open url action//////////////////////////////////////////////////////////////////////////
var openUrl = function(urlinfo){
    page.address = urlinfo['url'];
    page.inject_jquery = urlinfo['inject_jquery'];
    page.script = urlinfo['script'];
    page.navigate_rules = urlinfo['navigate_rules'];

    if(urlinfo['referer']){
        page.customHeaders = {
            'Referer': urlinfo['referer']
        };
    }

    if(urlinfo['cookie']){
        page.addCookie(JSON.parse(urlinfo['cookie']));
    }

    page.open(page.address, function (status) {
        if (status !== 'success') {
            sendToCaller({'signal':CMD_SIGNAL_EXCEPTION,'message':'Open page failed'});
        } else {
            page.endTime = new Date();

            var injected = false;
            if(page.inject_jquery){
                injected = page.injectJs("jquery-1.10.2.min.js");
            }
            var js_result = [];
            if(page.script){
                js_result = jsExec(page.script);
            }
            var result = {"signal":CMD_SIGNAL_CRAWL_SUCCESS,"content":page.content,"remoteProxy":page.remoteProxy,"cost":page.endTime-page.startTime,"inject_jquery":injected,"js_result":js_result};
            sendToCaller(result);
            if(page.navigate_rules.length>0){
                //pass
            }else{
                phantom.exit();
            }
        }
    });
}

var jsExec= function(commad){
    return page.evaluate(function(commad){
        var jsexec_result = [];
        try{
            eval(commad);
        }catch(e){
            sendToCaller({'signal':CMD_SIGNAL_EXCEPTION,'message':e});
        }
        return jsexec_result;
    },commad);
}

////caller interactive////////////////////////////////////////////////////////////////////////
var sendToCaller = function(msg){
    //console.log(JSON.stringify(msg));
    system.stdout.writeLine(JSON.stringify(msg)+'#^_^#');
}

var commandExec = function(str){
    var cmd = JSON.parse(str);
    switch(cmd['signal']){
        case CMD_SIGNAL_EXIT:
            phantom.exit();
            break;
        case CMD_SIGNAL_OPENURL:
            openUrl(cmd['url']);
            break;
        case CMD_SIGNAL_JQEXEC:
            break;
        default:
            sendToCaller({"signal":CMD_SIGNAL_STATUS,"message":"receive signal: "+cmd['signal']});
    }

}

////check out command from caller/////////////////////////////////////////////////////////////////
setInterval(function(){
    var input='';
    var braces = 0;//number of not paired '{}'
    var brackets = 0;//number of not paired of '[]'
    var count = 0;

    while(++count){
        var character = system.stdin.read(1);
        if(count===1&&character!=='{')break;
        if(character==='{')braces++;
        if(character==='}')braces--;
        if(character==='[')brackets++;
        if(character===']')brackets--;
        input += character;
        if(braces===0&&brackets===0)break;
    }
    if(input!='')commandExec(input);
},100);
/*
var url = 'http://ju.taobao.com/?spm=1.6659421.754904973.2.ALtBmk';
var script = "jsexec_result = $.makeArray($('.category li a span').text())";
var urlinfo = {"url":url,"type":"branch","referer":"http://www.taobao.com","jshandle":true,"inject_jquery":true,"script":script,"navigate_rules":[]}
openUrl(urlinfo);
*/