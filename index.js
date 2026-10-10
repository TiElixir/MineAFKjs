'use strict';

const fs = require('node:fs');
const path = require('node:path');
const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const express = require('express');
const config = require('./settings.json');

const DATA_FILE = path.join(__dirname, 'lastIndex.dat');
const names = config['bot-account'].usernames;
let bot = null;
let reconnectTimer = null;
let messageTimer = null;
let shuttingDown = false;
let status = { state: 'offline', username: null, since: new Date().toISOString(), error: null };

function validateConfig() {
  if (!config.server.ip || config.server.ip.includes('<')) throw new Error('Set server.ip in settings.json before starting.');
  if (!Number.isInteger(Number(config.server.port)) || Number(config.server.port) < 1 || Number(config.server.port) > 65535) throw new Error('server.port must be a valid TCP port.');
  if (!Array.isArray(names) || names.length === 0 || names.some(name => typeof name !== 'string' || !/^[A-Za-z0-9_]{1,16}$/.test(name))) throw new Error('Configure at least one valid Minecraft username (1-16 letters, numbers, or underscores).');
  if (config.utils['chat-messages'].enabled && config.utils['chat-messages'].repeat && Number(config.utils['chat-messages']['repeat-delay']) < 1) throw new Error('Chat repeat delay must be at least one second.');
}

function nextUsername() {
  let index = 0;
  try {
    const saved = Number.parseInt(fs.readFileSync(DATA_FILE, 'utf8').trim(), 10);
    if (Number.isInteger(saved) && saved >= 0) index = saved % names.length;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`[TiElixir] Could not read account rotation state: ${error.message}`);
  }
  const username = names[index];
  const next = (index + 1) % names.length;
  try {
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, String(next), { mode: 0o600 });
    fs.renameSync(tempFile, DATA_FILE);
  } catch (error) {
    console.warn(`[TiElixir] Could not save account rotation state: ${error.message}`);
  }
  return username;
}

function setStatus(state, error = null) {
  status = { state, username: bot?.username || status.username, since: new Date().toISOString(), error: error ? String(error) : null };
}

function clearTimers() {
  clearTimeout(reconnectTimer);
  clearInterval(messageTimer);
  reconnectTimer = null;
  messageTimer = null;
}

function scheduleReconnect() {
  if (shuttingDown || !config.utils['auto-reconnect'] || reconnectTimer) return;
  const delay = Math.max(1000, Number(config.utils['auto-reconnect-delay']) || 5000);
  console.log(`[TiElixir] Reconnecting in ${delay}ms.`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, delay);
}

function createBot() {
  if (shuttingDown) return;
  clearTimers();
  const username = nextUsername();
  setStatus('connecting');
  console.log(`[TiElixir] Connecting ${username} to ${config.server.ip}:${config.server.port}...`);
  try {
    bot = mineflayer.createBot({
      username,
      password: config['bot-account'].password || undefined,
      auth: config['bot-account'].type || 'offline',
      host: config.server.ip,
      port: Number(config.server.port),
      version: config.server.version || false,
      hideErrors: false,
    });
    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
      setStatus('online');
      console.log(`[TiElixir] ${username} joined the server.`);
      try {
        const mcData = require('minecraft-data')(bot.version);
        const movements = new Movements(bot, mcData);
        movements.canDig = false;
        bot.pathfinder.setMovements(movements);
        if (config.position.enabled) {
          const { x, y, z } = config.position;
          bot.pathfinder.setGoal(new GoalBlock(x, y, z));
          console.log(`[TiElixir] Pathfinding to ${x}, ${y}, ${z}.`);
        }
      } catch (error) {
        console.error(`[TiElixir] Could not initialize movement: ${error.message}`);
      }

      if (config.utils['anti-afk'].enabled) {
        bot.setControlState('jump', true);
        if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
      }
      const chat = config.utils['chat-messages'];
      if (chat.enabled && chat.messages.length) {
        let index = 0;
        const sendMessage = () => {
          if (!bot || !bot.player) return;
          try { bot.chat(chat.messages[index % chat.messages.length]); }
          catch (error) { console.warn(`[TiElixir] Chat message failed: ${error.message}`); }
          index += 1;
        };
        sendMessage();
        if (chat.repeat) messageTimer = setInterval(sendMessage, Math.max(1, Number(chat['repeat-delay']) || 60) * 1000);
      }
    });

    bot.on('message', message => {
      if (config.utils['chat-log']) console.log(`[Chat] ${message.toString()}`);
      const auth = config.utils['auto-auth'];
      if (auth.enabled && auth.password && /\/register|\/login|password/i.test(message.toString())) {
        try { bot.chat(`/login ${auth.password}`); }
        catch (error) { console.warn(`[TiElixir] Authentication message failed: ${error.message}`); }
      }
    });
    bot.on('death', () => console.log(`[TiElixir] ${username} died.`));
    bot.on('kicked', reason => {
      const detail = typeof reason === 'string' ? reason : JSON.stringify(reason);
      setStatus('kicked', detail);
      console.warn(`[TiElixir] Kicked: ${detail}`);
    });
    bot.on('error', error => {
      setStatus('error', error.message);
      console.error(`[TiElixir] ${error.message}`);
    });
    bot.on('end', reason => {
      clearTimers();
      setStatus('offline', reason || null);
      console.log(`[TiElixir] Disconnected${reason ? `: ${reason}` : '.'}`);
      scheduleReconnect();
    });
  } catch (error) {
    bot = null;
    setStatus('error', error.message);
    console.error(`[TiElixir] Connection setup failed: ${error.message}`);
    scheduleReconnect();
  }
}

function startStatusServer() {
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_request, response) => response.status(status.state === 'online' ? 200 : 503).json({ service: 'TiElixir', ...status }));
  const port = Number(process.env.STATUS_PORT || 3000);
  const host = process.env.STATUS_HOST || '127.0.0.1';
  const server = app.listen(port, host, () => console.log(`[TiElixir] Health endpoint listening on http://${host}:${port}/health.`));
  server.on('error', error => console.error(`[TiElixir] Health server failed: ${error.message}`));
  return server;
}

function shutdown(signal, server) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[TiElixir] ${signal}: shutting down.`);
  clearTimers();
  if (server) server.close();
  if (bot) bot.quit('TiElixir shutting down');
  setTimeout(() => process.exit(0), 3000).unref();
}

try {
  validateConfig();
  const statusServer = startStatusServer();
  process.once('SIGINT', () => shutdown('SIGINT', statusServer));
  process.once('SIGTERM', () => shutdown('SIGTERM', statusServer));
  createBot();
} catch (error) {
  console.error(`[TiElixir] Configuration error: ${error.message}`);
  process.exitCode = 1;
}
