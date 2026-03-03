const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

const SESSIONS_DIR = path.join(__dirname, "../../sessions");
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

async function createPairingSession(userId) {
  const userFolder = path.join(SESSIONS_DIR, String(userId));
  if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder);

  const { state, saveCreds } = await useMultiFileAuthState(userFolder);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);
  return sock;
}

module.exports = { createPairingSession };