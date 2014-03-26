/**
 * Created by cherokee on 14-3-25.
 */

var retryTimes = 0;

var spawnIt = function(tryTimes){
    var spawn = require('child_process').spawn;
    var runner = spawn('node',['run.js'].concat(process.argv));

    runner.stdout.on('data', function (data) {
        console.log(data.toString('utf8'));
    });

    runner.stderr.on('data', function (data) {
        console.log(data.toString('utf8'));
    });

    runner.on('exit', function (code, signal) {
        console.log('Child process exit ：' + code+', '+signal);
        if(code!==0&&tryTimes<500){
            console.log('Restart, times: '+(tryTimes++));
            process.nextTick(function(){spawnIt(tryTimes)});
            spawn = null;
        }
    });
}

spawnIt(0);
