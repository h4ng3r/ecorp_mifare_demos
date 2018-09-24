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
			})
		} else {

			let last_card_uid = ""
			var self = this

			// I hate this setInterval but fix all the main loop problems
			setInterval(function(){
				self.mfrc522.reset()
	   			
	   			let response = self.mfrc522.findCard();
				if (!response.status) { return  }

			    response = self.mfrc522.getUid();
				if (!response.status) { return  }

			    let uid = response.data;

			    uid = uid[0].toString(16) + uid[1].toString(16) + uid[2].toString(16) + uid[3].toString(16)
			    
			    if (last_card_uid != uid) {
			    	console.log("EMIT" + uid.toUpperCase())
			    	self.emit("card", uid.toUpperCase())
		    	}

		    	last_card_uid = uid
    		}, 200)
		}
	}

	async readBlock(block, keyType, key) {
		if(this.type == "USB") {
			if (keyType == "A") keyType = KEY_TYPE_A
			else keyType = KEY_TYPE_B
			await this.reader.authenticate(4, keyType, key)
			const data = await this.reader.read(4, 16);
			return Promise.resolve(data)
		} else {
		}
	}

/*

OLD FUNCTION WITH AUTHENTICATION TEST

	readCardUID() {
		if(this.type == "USB") {
			this.nfc.on('reader', reader => {

				reader.on('card', async card => {

					// card is object containing following data
					// [always] String type: TAG_ISO_14443_3 (standard nfc tags like Mifare) or TAG_ISO_14443_4 (Android HCE and others)
					// [always] String standard: same as type
					// [only TAG_ISO_14443_3] String uid: tag uid
					// [only TAG_ISO_14443_4] Buffer data: raw data from select APDU response

					console.log(`${reader.reader.name}  card detected`, card);


					const key = 'FFFFFFFFFFFF';
					const keyType = 0x60;
					console.log(keyType)
				    
				    const valid = await reader.authenticate(4, keyType, key)
			       	const data = await reader.read(4, 16);
	    			return Promise.resolve(data)

				});
			});

		} else {

		    this.mfrc522.reset()
   			
   			let response = this.mfrc522.findCard();
			while (!response.status) { response = this.mfrc522.findCard();  }

			    response = this.mfrc522.getUid();

			    //# If we have the UID, continue
			    const uid = response.data;
			    return uid[0].toString(16) + uid[1].toString(16) + uid[2].toString(16) + uid[3].toString(16)

		}
	}

*/

};

module.exports = Wrapper;
