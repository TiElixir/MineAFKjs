# MineAFKjs
<p align="center"> 
    <img src="https://img.shields.io/github/issues/yashbos5620x/MineAFKjs">
    <img src="https://img.shields.io/github/forks/yashbos5620x/MineAFKjs">
    <img src="https://img.shields.io/github/stars/yashbos5620x/MineAFKjs">
    <img src="https://img.shields.io/github/license/yashbos5620x/MineAFKjs">


MineAFKjs is a JavaScript tool used to create a bot using Mineflayer that joins your server.

## Installation

Install  [Node.js](https://nodejs.org/en). and run the below command in Terminal of your Folder
```
npm install requirements
```

## Usage

Head to the `settings.json` file and  put your server IP and port here

```json
  "server": {
    "ip": "<YOUR SERVER IP>", 
    "port": 25565,  //Change this to your port
    "version": "1.12.1"   
  },
```
Do not change the version no matter what.

After configuring the `settings.json`, you can run the following command in the Terminal to start the bot and make it join.

```bash
node index.js
```

The bot should join the server.

## Customization

1. **Name Customization:** 
To customize the name of the bot head to `index.js` (Line 8) and replace ``username1``, ``username2``and ``username3`` with the names you want. It cycles between these names every time the bot joins the server. 

```javascript
const usernames = ["username1", "username2", "username3"];
```
2. **Path Finder:** To enable pathfinder go to `settings.json` and change enabled to true in position and enter the X, Y, Z coordinates of the destination to path find.
```json
  "position": {
    "enabled": true,
    "x": 69,
    "y": 69,
    "z": 69
  },
```
3. **Messages:** To customize messages sent by the bot in the server, go to `settings.json` and put your messages here

```json
      "messages": [
        "message1",
        "message2",
        "message3"
      ]
```
4. **AUTH:** WORK IN PROGRESS*



## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

This is a premature project that I made for my use so it may be a bit too specific, i would suggest using ai tools to edit this according to your usage incase you are a beginner.

## License

[MIT](https://choosealicense.com/licenses/mit/)
