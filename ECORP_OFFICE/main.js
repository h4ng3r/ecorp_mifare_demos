var express = require('express');
var http = require('http');

var app = express();
var server = http.createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');

const WRAPPER = require("./wrapper.js")

var ACCESS_DICTIONARY = {}

var reader_type = "USB"
if (process.argv.length > 2 && process.argv[2] == "--gpio") reader_type = "GPIO"

var wrapper = new WRAPPER(reader_type)

// read access.csv and fill the ACCESS_DICTIONARY

var fs = require('fs');
fs.readFile( __dirname + '/access.csv', function (err, data) {
  if (err) {
    throw err; 
  }
  const rows = data.toString().split('\n');
  for (var i = 0; i < rows.length; i++) {
     const x = rows[i].split(",")
     ACCESS_DICTIONARY[x[0]] = x[1]
  }
});

console.log("file read")

// handle and serve the http server and files

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.use('/static', express.static(__dirname + '/static'));

server.listen(8080);
console.log("server up")

// emit socket on detect card

wrapper.on("card", async uid => {
	console.log("Read card " + uid)
	//const x = await wrapper.readBlock(4, "A", "FFC211223358")
	//console.log(x)
	if (uid in ACCESS_DICTIONARY) {
		io.sockets.emit("rfid", {'name': ACCESS_DICTIONARY[uid], 'uid': uid, "is_valid": true})
	} else {
		io.sockets.emit("rfid", {'name': "", 'uid': uid, "is_valid": false})
	}
});

// wait for card this needs to be in at the end or will block
console.log("wrapper up")
wrapper.waitCard()
	.then(function(){})
	.catch(function(){})
