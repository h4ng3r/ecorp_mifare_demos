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
    coins = coins * 100
    var s = coins.toString(10).padStart(8, '0').padEnd(32, '0')
    var xorkey = (uid + uid + uid + uid + uid + uid + uid).substring(0, 32)
    var data = xorCrypt(s,xorkey)
    try {
        var resp = await wrapper.writeBlock(8, "B", B_KEY, data)
    } catch (e) {
        var resp = await wrapper.writeBlock(8, "B", "FFFFFFFFFFFF", data)
        var resp = await wrapper.writeBlock(11, "B", "FFFFFFFFFFFF", "14F7D83E6712FF0780699AB256DE78FF")
        return resp
    }
    return resp
}


wrapper.on("card", async uid => {

	console.log("Card detected... writing...")

    var res = await writeCard(uid, 1.20)

    if (res == 1) {
        console.log("Card has been correctly written!")
    } else {
        console.log("Error writting the card...")
    }

    process.exit(0);
});

console.log("Waiting card...")

wrapper.waitCard()
    .then(function(){})
    .catch(function(){})