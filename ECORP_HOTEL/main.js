var express = require('express');
var http = require('http');
const expressNunjucks = require('express-nunjucks');

var app = express();
var server = http.createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');

const isDev = app.get('env') === 'development';

const mongoose = require('mongoose');

const WRAPPER = require("./wrapper.js")

const A_KEY = "8756df5612ab"
const B_KEY = "98a425bd468b"
const READER_NUMHAB = 7215

const CARD_TYPE = {
  GUEST: 0x47,
  SERVICE: 0x53,
  MASTER: 0x4D
};

var reader_type = "USB"
if (process.argv.length > 2 && process.argv[2] == "--gpio") reader_type = "GPIO"

var wrapper = new WRAPPER(reader_type)

function encodeCard(type, id, building, floor, numhab, cardnum, checkindate, checkoutdate) {
    s = type.toString(10) + id.toString(10).padStart(8, '0') + building.toString(10).padStart(4, '0')  + floor.toString(10).padStart(4, '0')  + numhab.toString(10).padStart(8, '0')  + cardnum.toString(10).padStart(4, '0')
    s = s.padEnd(32, '0')
    s += "00000"
    s += (checkindate.getFullYear() - 2000) + (checkindate.getMonth()+1).toString(10).padStart(2, '0') + checkindate.getDate().toString(10).padStart(2, '0') + checkindate.getHours().toString(10).padStart(2, '0') + checkindate.getMinutes().toString(10).padStart(2, '0') + checkindate.getSeconds().toString(10).padStart(2, '0')
    s += (checkoutdate.getFullYear() - 2000) + (checkoutdate.getMonth()+1).toString(10).padStart(2, '0') + checkoutdate.getDate().toString(10).padStart(2, '0') + checkoutdate.getHours().toString(10).padStart(2, '0') + checkoutdate.getMinutes().toString(10).padStart(2, '0') + checkoutdate.getSeconds().toString(10).padStart(2, '0')
    s = s.padEnd(64, '0')
    return s
}

function decodeCard(encoded_card) {
    const type = encoded_card.substring(0, 2)
    const id = parseInt(encoded_card.substring(2, 10), 10)
    const building = parseInt(encoded_card.substring(10, 14), 10)
    const floor = parseInt(encoded_card.substring(14, 18), 10)
    const numhab = parseInt(encoded_card.substring(18, 26), 10)
    const cardnum = parseInt(encoded_card.substring(26, 30), 10)

    const checkindate = new Date((parseInt(encoded_card.substring(37, 39), 10))+2000,(parseInt(encoded_card.substring(39, 41), 10)-1),parseInt(encoded_card.substring(41, 43), 10),parseInt(encoded_card.substring(43, 45), 10),parseInt(encoded_card.substring(45, 47), 10),parseInt(encoded_card.substring(47, 49), 10))
    const checkoutdate = new Date((parseInt(encoded_card.substring(49, 51), 10))+2000,(parseInt(encoded_card.substring(51, 53), 10)-1),parseInt(encoded_card.substring(53, 55), 10),parseInt(encoded_card.substring(55, 57), 10),parseInt(encoded_card.substring(57, 59), 10),parseInt(encoded_card.substring(59, 61), 10))

    return { type: type, id: id, building: building, floor: floor, numhab: numhab, cardnum:cardnum, checkindate: checkindate.toLocaleString(), checkoutdate: checkoutdate.toLocaleString() }

    console.log("TYPE:".padEnd(20, ' ') + type)
    console.log("ID:".padEnd(20, ' ') + id)
    console.log("BUILDING:".padEnd(20, ' ') + building)
    console.log("FLOOR:".padEnd(20, ' ') + floor)
    console.log("HAB:".padEnd(20, ' ') + numhab)
    console.log("CARDNUM:".padEnd(20, ' ') + cardnum)
    console.log("CHECKIN DATE:".padEnd(20, ' ') + checkindate.toLocaleString())
    console.log("CHECKOUT DATE:".padEnd(20, ' ') + checkoutdate.toLocaleString())
}

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

mongoose.connect('mongodb://localhost/evilhotel');
 
app.set('views', __dirname + '/templates');
 
app.use('/static', express.static('static'));

const njk = expressNunjucks(app, {
    watch: isDev,
    noCache: isDev
});
 
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/write', (req, res) => {
    res.render('write');
});

var schema = new mongoose.Schema({ room_number: 'number', building: 'number', floor: 'number' });
var Room = mongoose.model('Room', schema);

app.get('/logs', async (req, res) => {
    let logs = await Room.find({})
    res.render('log', {logs:logs} );
});


app.post('/generateCard', async (req, res) => {
    try {
        const x = await Room.create({ room_number: req.body.RoomNumber, building: req.body.Building, floor: req.body.Floor})
        const id = await Room.count()
        const cardinal = await Room.count({ room_number: req.body.RoomNumber, building: req.body.Building, floor: req.body.Floor})

        var checkinDate = new Date()
        var checkout = req.body.Checkoutdate.split("/");
        var checkoutDate = new Date(checkout[2], checkout[1] - 1, checkout[0]);
        checkoutDate.setHours(12)
        checkoutDate.setMinutes(5)
        checkoutDate.setSeconds(0)

        const encoded_card = encodeCard(CARD_TYPE.GUEST, id, req.body.Building, req.body.Floor, req.body.RoomNumber, cardinal, checkinDate, checkoutDate)

        await wrapper.writeBlock(4, "B", B_KEY, encoded_card.substring(0, 32))
        await wrapper.writeBlock(5, "B", B_KEY, encoded_card.substring(32, 64))

        //res.redirect('/')
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ res: 1, error: "" }));
    
    } catch (error) {
        console.error(error);
        res.send(JSON.stringify({ res: 0, error: error }));
    }
});

app.get('/reader', (req, res) => {
    res.render('reader');
});

// emit socket on detect card

let current_card = null

function is_card_valid(card) {
    var today = new Date();

    if (new Date(card.checkindate) < today && today < new Date(card.checkoutdate) 
        && card.numhab == READER_NUMHAB) {
        return true
    }
    return false
}

wrapper.on("card", async uid => {
    const half1 = await wrapper.readBlock(4, "A", A_KEY)
    const half2 = await wrapper.readBlock(5, "A", A_KEY)

    var s = ""
    for (var i = 0; i < half1.length; i++) {
        s += half1[i].toString(16).padStart(2, '0')
    }
    for (var i = 0; i < half2.length; i++) {
        s += half2[i].toString(16).padStart(2, '0')
    }   

    current_card = decodeCard(s)
    io.sockets.emit("rfid", decodeCard(s))
    io.sockets.emit("reader", {is_valid: is_card_valid(current_card)})
});

wrapper.on("card.off", () => {
    current_card = null
    io.sockets.emit("rfid.off")
});


io.on('connection', function(socket){

  if (current_card) io.sockets.emit("rfid", current_card)

  socket.on('chat message', function(msg){
    console.log('message: ' + msg);
  });


});


server.listen(8080, "0.0.0.0");
console.log("server up")

wrapper.waitCard()
    .then(function(){})
    .catch(function(){})