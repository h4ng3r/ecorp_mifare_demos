"use strict";

const EventEmitter = require('events')

const TAG_ISO_14443_3 = 'TAG_ISO_14443_3'
const TAG_ISO_14443_4 = 'TAG_ISO_14443_4'

const KEY_TYPE_A = 0x60
const KEY_TYPE_B = 0x61

class Wrapper extends EventEmitter {

    constructor(type) {
        super()

        this.type = type
        if(this.type == "USB") {
            const { NFC } = require('nfc-pcsc');
            this.nfc = new NFC();   
        } else {
            this.mfrc522 = require("mfrc522-rpi");
            this.mfrc522.initWiringPi(0);
        }

    }

    sleep(ms){
        return new Promise(resolve=>{
            setTimeout(resolve,ms)
        })
      }

    ticker(self) {

        self.mfrc522.reset()
            
        let response = self.mfrc522.findCard();
        if (!response.status) {
            if (self.last_card_uid) {
                self.emit("card.off")
                self.last_card_uid = null
            }
            return 
        }

        response = self.mfrc522.getUid();
        if (!response.status) { return  }

        let uid = response.data;
        uid = uid[0].toString(16) + uid[1].toString(16) + uid[2].toString(16) + uid[3].toString(16)
        
        if (self.last_card_uid != uid) {
            self.last_card_uid = uid
            this.last_card_uid_raw = response.data
            self.emit("card", uid.toUpperCase())
        }

    }

    async waitCard() {
        if(this.type == "USB") {
            this.nfc.on('reader', reader => {
                this.reader = reader
                reader.on('card', card => {
                    if (card.type === TAG_ISO_14443_3) {
                        const uid = card.uid.toUpperCase()
                        this.emit("card", uid)
                    }
                })

                reader.on('card.off', card => {
                    this.emit("card.off")
                });
            })
        } else {

            this.last_card_uid = ""
            var self = this
            this.timer = setInterval(function() { self.ticker(self); }, 200);
        }
    }

    async readBlock(block, keyType, key) {
        if(this.type == "USB") {
            if (keyType == "A") keyType = KEY_TYPE_A
            else keyType = KEY_TYPE_B
            await this.reader.authenticate(block, keyType, key)
            const data = await this.reader.read(block, 16);
            return Promise.resolve(data)
        } else {
            
            clearInterval(this.timer)
            var self = this
            this.mfrc522.selectCard(this.last_card_uid_raw)
            let keya = []
            for (var i = 0; i < key.length; i+=2) {
                keya.push(parseInt(key[i]+key[i+1], 16))
            }
            var resp = this.mfrc522.authenticate(block, keya, this.last_card_uid_raw)
            if (resp) {
                const data = this.mfrc522.getDataForBlock(block)
                this.timer = setInterval(function() { self.ticker(self); }, 200);
                return Promise.resolve(data)
            } else {
                console.log("Read authenticate rejected!")
                this.timer = setInterval(function() { self.ticker(self); }, 200);
                return Promise.reject()
            }
        }
    }

    async writeBlock(block, keyType, key, data) {
        if(this.type == "USB") {
            if (keyType == "A") keyType = KEY_TYPE_A
            else keyType = KEY_TYPE_B
            await this.reader.authenticate(block, keyType, key)
    
            var arr = []
            for (var i = 0; i < 32; i+=2) {
                arr.push(parseInt(data[i] + data[i+1], 16))
            }
            var buf = Buffer.from(arr);
            const ok = await this.reader.write(block, buf, 16);
            return Promise.resolve(ok)
        } else {

            let keya = []
            for (var i = 0; i < key.length; i+=2) {
                keya.push(parseInt(key[i]+key[i+1], 16))
            }
            let dataar = []
            for (var i = 0; i < data.length; i+=2) {
                dataar.push(parseInt(data[i]+data[i+1], 16))
            }

            clearInterval(this.timer)
            var self = this
            self.wrote = false
            while(!self.wrote) {

                self.mfrc522.reset()
            
                let response = self.mfrc522.findCard();
                if (!response.status) continue

                response = self.mfrc522.getUid();
                if (!response.status) continue

                let uid = response.data;
                this.mfrc522.selectCard(uid)
        
                var resp = this.mfrc522.authenticateB(8, [154, 178, 86, 222, 120, 255], uid)

                if (resp) {
                    const r = this.mfrc522.writeDataToBlock(block, dataar)
                    this.timer = setInterval(function() { self.ticker(self); }, 200);
                    return Promise.resolve(true)
                } else {
                    console.log("Write authenticate rejected!")
                    this.timer = setInterval(function() { self.ticker(self); }, 200);
                    return Promise.reject()
                }
            }
        }
    }

};

module.exports = Wrapper;
