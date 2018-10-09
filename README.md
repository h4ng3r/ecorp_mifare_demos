# ECorp Mifare Demos

Slides [MIFARE Hacking: You can't hold the door](https://github.com/h4ng3r/Slides/raw/master/NavajaNegra_2018_MIFARE_Hacking_You_cant_hold_the_door.pdf)

**WORK IN PROGRESS!!!!**

Some mifare based access systems for demos and workshops

## Content

* **ECORP_HOTEL**: A full system that emulates a room access system based on Mifare Classic 1k. It includes the reader website an a administration website.
* **ECORP_OFFICE**: A system that uses the card UID to simulate an access system.
* **ECORP_VENDING**: A system that simulates a vending machine.


## Instalation

sudo apt-get install mongodb-server


Check your reader section and after instaling the dependencies just run:
```npm install```


### ACR122U
```
sudo apt-get install pcscd libusb-dev libpcsclite1 libpcsclite-dev dh-autoreconf
npm install nfc-pcsc
```

### GPIO
```
npm install mfrc522-rpi
```
For wiring and enabling SPI check: https://www.npmjs.com/package/mfrc522-rpi


## Authors

* **Marc** - *Initial work*

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
