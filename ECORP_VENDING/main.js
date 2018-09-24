var express = require('express');
var http = require('http');
const expressNunjucks = require('express-nunjucks');


var app = express();
var server = http.createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');

const isDev = app.get('env') === 'development';
const WRAPPER = require("./wrapper.js")

var reader_type = "USB"
if (process.argv.length > 2 && process.argv[2] == "--gpio") reader_type = "GPIO"

var wrapper = new WRAPPER(reader_type)

const A_KEY = "14f7d83e6712"
const B_KEY = "9ab256de78ff"

function xorCrypt (str, key) {
    var output = ''
    for (var i = 0; i < str.length; ++i) {
      output += ( parseInt(str[i],16) ^ parseInt(key[i],16) ).toString(16)
    }
    return output.toUpperCase()
}


async function readCard(uid) {
    var xorkey = (uid + uid + uid + uid + uid + uid + uid).substring(0, 32)
    const half1 = await wrapper.readBlock(8, "A", A_KEY)
    var s = ""
    for (var i = 0; i < half1.length; i++) {
        s += half1[i].toString(16).padStart(2, '0')
    }
    return (parseFloat(xorCrypt(s, xorkey).substring(0,8))/100).toFixed(2)
}


async function writeCard(uid, coins) {
    //coins = coins * 100
    var s = coins.toString(10).padStart(8, '0').padEnd(32, '0')
    var xorkey = (uid + uid + uid + uid + uid + uid + uid).substring(0, 32)
    var data = xorCrypt(s,xorkey)
    var resp = await wrapper.writeBlock(8, "B", B_KEY, data)
    return resp
}

 
app.set('views', __dirname + '/templates');
 
app.use('/static', express.static('static'));

const njk = expressNunjucks(app, {
    watch: isDev,
    noCache: isDev
});
 
app.get('/', (req, res) => {
    res.render('index');
});


app.post('/buy', (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    let p = req.query.p
    if (p > 0) {
        if (current_card) {
            readCard(current_uid).then(function(coins) {
                var price = p
                var coins = parseFloat(coins) * 100
                if (coins >= price) {
                    writeCard(current_uid, coins-price).then(function(r){
                        if(r) {
                            current_card = ((coins-price)/100).toFixed(2)
                            io.sockets.emit("rfid", current_card)
                            res.send(JSON.stringify({ res: 1, error: "" }));
                        } else {
                            res.send(JSON.stringify({ res: 0, error: "Error writing card" }));
                        }
                    });
                } else {
                    res.send(JSON.stringify({ res: 0, error: "No enought founds" }));        
                }
            })
        } else {
            res.send(JSON.stringify({ res: 0, error: "No card selected" }));
        }
    } else {
        res.send(JSON.stringify({ res: 0, error: "Error invalid price" }));
    }
});

app.post('/reset', (req, res) => {
    writeCard(current_uid, 120).then(function(){ res.send(JSON.stringify({ res: 1, error: "" })); })
    current_card = "1.20"
    io.sockets.emit("rfid", current_card)
});    

// emit socket on detect card

let current_card = null
let current_uid = null

wrapper.on("card", async uid => {
    current_uid = uid
    current_card = await readCard(uid)
    io.sockets.emit("rfid", current_card)
});

wrapper.on("card.off", () => {
    current_card = null
    io.sockets.emit("rfid.off")
});


io.on('connection', function(socket){
  if (current_card) io.sockets.emit("rfid", current_card)
});

server.listen(8080);
console.log("server up")

wrapper.waitCard()
    .then(function(){})
    .catch(function(){})