const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const fs = require('fs');
const express = require('express');
const readline = require('readline');
const config = require('./settings.json');
const usernames = ["username1", "username2", "username3"]; 
const filename = "lastIndex.dat";
function getNextUsername() {
    let lastIndex = fs.existsSync(filename) ? parseInt(fs.readFileSync(filename, "utf8")) || 0 : 0;
    const username = usernames[lastIndex];
    fs.writeFileSync(filename, ((lastIndex + 1) % usernames.length).toString());
    return username;
}
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
    defaultMove.canDig = false; 
    bot.settings.colorsEnabled = false;
    function sendRegister(password) {
        return new Promise((resolve, reject) => {
            bot.chat(`/register ${password} ${password}`);
            console.log(`[Auth] Sent /register command.`);
            bot.once('chat', (username, message) => {
                console.log(`[ChatLog] <${username}> ${message}`); 
                if (message.includes('successfully registered')) {
                    console.log('[INFO] Registration confirmed.');
                    resolve();
                } else if (message.includes('already registered')) {
                    console.log('[INFO] Bot was already registered.');
                    resolve(); 
                } else if (message.includes('Invalid command')) {
                    reject(`Registration failed: Invalid command. Message: "${message}"`);
                } else {
                    reject(`Registration failed: unexpected message "${message}".`);
                }
            });
        });
    }
    function sendLogin(password) {
        return new Promise((resolve, reject) => {
            bot.chat(`/login ${password}`);
            console.log(`[Auth] Sent /login command.`);
            bot.once('chat', (username, message) => {
                console.log(`[ChatLog] <${username}> ${message}`); 
                if (message.includes('successfully logged in')) {
                    console.log('[INFO] Login successful.');
                    resolve();
                } else if (message.includes('Invalid password')) {
                    reject(`Login failed: Invalid password. Message: "${message}"`);
                } else if (message.includes('not registered')) {
                    reject(`Login failed: Not registered. Message: "${message}"`);
                } else {
                    reject(`Login failed: unexpected message "${message}".`);
                }
            });
        });
    }
    let pendingPromise = Promise.resolve(); 
    bot.once('spawn', () => {
        console.log('\x1b[32m[AfkBot]\x1b[0m', `${username} joined the server.`);
        botStatus = 'Joined';
        if (config.utils['auto-auth'].enabled) {
            console.log('[INFO] Started auto-auth module');
            const password = config.utils['auto-auth'].password;
            pendingPromise = pendingPromise
                .then(() => sendRegister(password))
                .then(() => sendLogin(password))
                .catch(error => console.error('[ERROR]', error));
        }
        setTimeout(() => bot.setControlState('jump', true), 8000); 
        setTimeout(() => bot.setControlState('sneak', true), 1000); 
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
                setTimeout(() => bot.setControlState('jump', true), 200); 
                setTimeout(() => bot.setControlState('sneak', true), 200); 
            }, 1000);
        }, 500); 
    });
    bot.on('death', () => {
        console.log('\x1b[31m[AfkBot]\x1b[0m', `${username} died and respawned.`);
        setTimeout(() => bot.setControlState('jump', false), 200); 
        setTimeout(() => bot.setControlState('sneak', false), 200); 
        setTimeout(() => {
            if (config.position.enabled) {
                console.log('\x1b[34m[AfkBot]\x1b[0m', `Re-pathfinding to target (${config.position.x}, ${config.position.y}, ${config.position.z})`);
                bot.pathfinder.setMovements(defaultMove);
                bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
            }
        }, 2000);
    });
    bot.on('kicked', reason => console.log('\x1b[33m[AfkBot]\x1b[0m', `Kicked: ${reason}`));
    bot.on('end', () => {
        console.log('\x1b[31m[AfkBot]\x1b[0m', `Bot disconnected.`);
        botStatus = 'Offline';
        if (autoReconnectEnabled) setTimeout(createBot, config.utils['auto-reconnect-delay']);
    });
}
createBot();
