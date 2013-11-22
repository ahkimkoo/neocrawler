/**
 * Created by james on 13-11-22.
 * phantom js bridge
 */

var system = require('system');
var page = require('webpage').create();

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
var openUrl = function(urlinfo,navigateRules){
    page.address = urlinfo['url'];
    page.navigateRules = navigateRules;

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
            //console.log('FAIL to load the address');
        } else {
            page.endTime = new Date();
            if(page.navigateRules.length>0){
                //pass
            }else{
                var result = {"signal":CMD_SIGNAL_CRAWL_SUCCESS,"content":page.content,"remoteProxy":page.remoteProxy,"cost":page.endTime-page.startTime};
                sendToCaller(result);
            }
        }
    });
}

////caller interactive////////////////////////////////////////////////////////////////////////
var sendToCaller = function(msg){
    system.stdout.writeLine(JSON.stringify(msg));
    //system.stdout.end();
}
//command signal defined
var CMD_SIGNAL_EXIT = -1;
var CMD_SIGNAL_STATUS = 0;
var CMD_SIGNAL_EXCEPTION = 1;
var CMD_SIGNAL_OPENURL = 10;
var CMD_SIGNAL_CRAWL_SUCCESS = 20;


var commandExec = function(str){
    var cmd = JSON.parse(str);
    switch(cmd['signal']){
        case CMD_SIGNAL_EXIT:
            phantom.exit();
            break;
        case CMD_SIGNAL_OPENURL:
            openUrl(cmd['url'],[]);
            break;
        default:
            //pass
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