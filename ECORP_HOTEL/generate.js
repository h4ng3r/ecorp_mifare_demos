const WRAPPER = require("./wrapper.js")

var reader_type = "USB"
if (process.argv.length > 2 && process.argv[2] == "--gpio") reader_type = "GPIO"

var wrapper = new WRAPPER(reader_type)

const A_KEY = "8756df5612ab"
const B_KEY = "98a425bd468b"
const READER_NUMHAB = 7215

const CARD_TYPE = {
  GUEST: 0x47,
  SERVICE: 0x53,
  MASTER: 0x4D
};

function encodeCard(type, id, building, floor, numhab, cardnum, checkindate, checkoutdate) {
    s = type.toString(10) + id.toString(10).padStart(8, '0') + building.toString(10).padStart(4, '0')  + floor.toString(10).padStart(4, '0')  + numhab.toString(10).padStart(8, '0')  + cardnum.toString(10).padStart(4, '0')
    s = s.padEnd(32, '0')
    s += "00000"
    s += (checkindate.getFullYear() - 2000) + (checkindate.getMonth()+1).toString(10).padStart(2, '0') + checkindate.getDate().toString(10).padStart(2, '0') + checkindate.getHours().toString(10).padStart(2, '0') + checkindate.getMinutes().toString(10).padStart(2, '0') + checkindate.getSeconds().toString(10).padStart(2, '0')
    s += (checkoutdate.getFullYear() - 2000) + (checkoutdate.getMonth()+1).toString(10).padStart(2, '0') + checkoutdate.getDate().toString(10).padStart(2, '0') + checkoutdate.getHours().toString(10).padStart(2, '0') + checkoutdate.getMinutes().toString(10).padStart(2, '0') + checkoutdate.getSeconds().toString(10).padStart(2, '0')
    s = s.padEnd(64, '0')
    return s
}

async function writeCard() {

    var checkinDate = new Date(2018, 9, 3, 20, 45, 12);
    var checkoutDate = new Date(2018, 9, 6, 12, 30, 00);

    const encoded_card = encodeCard(CARD_TYPE.GUEST, 178, 1, 3, READER_NUMHAB, 1, checkinDate, checkoutDate)

    try {
        //await wrapper.writeBlock(11, "B", "9ab256de78ff", "ffffffffffffff078069ffffffffffff")
        //await wrapper.writeBlock(8, "B", "FFFFFFFFFFFF", "00000000000000000000000000000000")
        await wrapper.writeBlock(4, "B", B_KEY, encoded_card.substring(0, 32))
        await wrapper.writeBlock(5, "B", B_KEY, encoded_card.substring(32, 64))
    } catch (e) {
        try {
            await wrapper.writeBlock(7, "B", "FFFFFFFFFFFF", "8756df5612abFF07806998a425bd468b")
            await wrapper.writeBlock(4, "B", B_KEY, encoded_card.substring(0, 32))
            await wrapper.writeBlock(5, "B", B_KEY, encoded_card.substring(32, 64))
        } catch (e) {
            return 0
        }
    }

    return 1
}

wrapper.on("card", async uid => {

	console.log("Card detected... writing...")

    var res = await writeCard()

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