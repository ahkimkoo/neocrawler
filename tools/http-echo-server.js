/**
 * Created by cherokee on 14-6-16.
 */
var http = require('http');
http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
        'IP':req.socket.remoteAddress,
        'HEADERS':(function(headers){
            var new_headers = {};
            for(var x in headers){
                if(headers.hasOwnProperty(x)){
                    new_headers[x.toUpperCase()] = headers[x];
                }
            }
            return new_headers;
        })(req.headers)
    }));
}).listen(1337, "0.0.0.0");
console.log('Http Echo Server running at http://127.0.0.1:1337/');