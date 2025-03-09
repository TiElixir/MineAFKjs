const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const fs = require('fs');
const express = require('express');
const readline = require('readline');
const config = require('./settings.json');

const usernames = ["username1", "username2", "username3"];   //you can add more usernames in this list
const filename = "lastIndex.dat";

function getNextUsername() {
    let lastIndex = fs.existsSync(filename) ? parseInt(fs.readFileSync(filename, "utf8")) || 0 : 0;
    const username = usernames[lastIndex];
    fs.writeFileSync(filename, ((lastIndex + 1) % usernames.length).toString());
    return username;
}

//stores the current index in a txt file so that it cycles when it boots up next time.

let bot = null;
let autoReconnectEnabled = config.utils['auto-reconnect'];
let botStatus = 'Offline';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const app = express();

function createBot() {
    const username = getNextUsername();
    bot = mineflayer.createBot({
        username,
        password: config['bot-account']['password'],
        auth: config['bot-account']['type'],
        host: config.server.ip,
        port: config.server.port,
        version: config.server.version,
    });

    bot.loadPlugin(pathfinder);
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    defaultMove.canDig = false; // Prevents breaking blocks while pathfinding
    bot.settings.colorsEnabled = false;

    bot.once('spawn', () => {
        console.log('\x1b[32m[AfkBot]\x1b[0m', `${username} joined the server.`);
        botStatus = 'Joined';

        if (config.utils['auto-auth'].enabled) {
            bot.chat(`/login ${config.utils['auto-auth'].password}`);
        }
        setTimeout(() => bot.setControlState('jump', true), 8000); //You can customise this, i'm using this just bcs it fits my usage case.
        setTimeout(() => bot.setControlState('sneak', true), 1000); //You can customise this, i'm using this just bcs it fits my usage case.

        if (config.position.enabled) {
            console.log('\x1b[34m[AfkBot]\x1b[0m', `Moving to target (${config.position.x}, ${config.position.y}, ${config.position.z})`);
            bot.pathfinder.setMovements(defaultMove);
            bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
        }
    });

    bot.on('goal_reached', () => {
        console.log('\x1b[32m[AfkBot]\x1b[0m', 'Bot reached the target location, starting to jump.');
        setTimeout(() => {
            bot.setControlState('jump', true);
            setInterval(() => {
                bot.setControlState('jump', false);
                setTimeout(() => bot.setControlState('jump', true), 200);//You can customise this, i'm using this just bcs it fits my usage case.
                setTimeout(() => bot.setControlState('sneak', true), 200);//You can customise this, i'm using this just bcs it fits my usage case.
                
            }, 1000);
        }, 500); // Ensure jumping starts after reaching location
    });

    bot.on('death', () => {
        console.log('\x1b[31m[AfkBot]\x1b[0m', `${username} died and respawned.`);
        setTimeout(() => bot.setControlState('jump', false), 200); //Line1
        setTimeout(() => bot.setControlState('sneak', false), 200);//Line2
        setTimeout(() => {
            if (config.position.enabled) {
                console.log('\x1b[34m[AfkBot]\x1b[0m', `Re-pathfinding to target (${config.position.x}, ${config.position.y}, ${config.position.z})`);
                bot.pathfinder.setMovements(defaultMove);
                bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
            }
        }, 2000);
    });
	//This is setup so that it stops Jumping and Crouching state, so that is can pathfind to the destination properly
	//The jumping and the crouching is then re-enabled in the bot.on(goal_reached) function above...
	//You can completely delete these the Line1 and Line2 if you arent using pathfinding.

    bot.on('kicked', reason => console.log('\x1b[33m[AfkBot]\x1b[0m', `Kicked: ${reason}`));
    bot.on('end', () => {
        console.log('\x1b[31m[AfkBot]\x1b[0m', `Bot disconnected.`);
        botStatus = 'Offline';
        if (autoReconnectEnabled) setTimeout(createBot, config.utils['auto-reconnect-delay']);
    });
}

createBot();
