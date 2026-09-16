const http = require("http");
const pino = require("pino");

let sock;

async function startBot() {
  const baileys = await import("@whiskeysockets/baileys");

  const makeWASocket =
    baileys.default || baileys.makeWASocket;

  const {
    useMultiFileAuthState,
    DisconnectReason
  } = baileys;

  const { state, saveCreds } =
    await useMultiFileAuthState("./auth_info");

  const logger = pino({ level: "silent" });

  sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
    markOnlineOnConnect: false
  });

  sock.ev.on("creds.update", saveCreds);

  let pairingRequested = false;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    console.log("WhatsApp connection:", connection);

    if (
      connection === "connecting" &&
      !state.creds.registered &&
      !pairingRequested
    ) {
      pairingRequested = true;

      const phone = process.env.BOT_PHONE_NUMBER;

      if (!phone) {
        console.log(
          "⚠️ BOT_PHONE_NUMBER is not set in Render."
        );
        return;
      }

      try {
        const code = await sock.requestPairingCode(phone);
        console.log("================================");
        console.log("WHATSAPP PAIRING CODE:", code);
        console.log("================================");
      } catch (error) {
        console.error("Pairing error:", error);
        pairingRequested = false;
      }
    }

    if (connection === "open") {
      console.log("✅ WhatsApp bot connected!");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("Reconnecting...");
        setTimeout(startBot, 5000);
      } else {
        console.log("❌ WhatsApp logged out.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    if (!msg || !msg.message) return;
    if (msg.key.fromMe) return;

    const jid = msg.key.remoteJid;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    const command = text.trim().toLowerCase();

    if (command === ".ping") {
      await sock.sendMessage(jid, {
        text: "🏓 Pong!"
      });
    }

    if (command === ".alive") {
      await sock.sendMessage(jid, {
        text: "🤖 Bot is online and working!"
      });
    }

    if (command === ".menu" || command === ".help") {
      await sock.sendMessage(jid, {
        text:
          "🤖 *WhatsApp Bot Menu*\n\n" +
          "🏓 .ping\n" +
          "❤️ .alive\n" +
          "📋 .menu\n" +
          "ℹ️ .help\n\n" +
          "More features will be added."
      });
    }
  });
}

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("WhatsApp bot is running.");
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on port ${PORT}`);
});

startBot().catch(console.error);
