const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
const pino = require("pino");
const { 
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const router = express.Router();
const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    async function WHITESHADOW_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            const sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                syncFullHistory: false,
                browser: Browsers.macOS("Safari")
            });

            // Request pairing code if not registered
            if (!sock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                if (!res.headersSent) await res.send({ code });
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === "open") {
                    await delay(5000);
                    const credsFile = __dirname + `/temp/${id}/creds.json`;

                    // Upload creds to Mega
                    const mega_url = await upload(fs.createReadStream(credsFile), `${sock.user.id}.json`);
                    const string_session = mega_url.replace('https://mega.nz/file/', '');
                    let sessionCode = "White-MD~" + string_session;
                   

                    // Send session code
                    const sessionMsg = await sock.sendMessage(sock.user.id, { text: sessionCode });

                    // Info message in Whiteshadow md
                    const infoMsg = `
*👋 Hello Whiteshadow-MD User!*

Your session has been successfully created ✅

🔐 *Session ID:* Sent above  
⚠️ Keep it safe! Do NOT share this ID with anyone.

——————

*📢 Official Channel:*  
https://whatsapp.com/channel/0029Vb4bj5zI7BeFm6aM8O1p

*💻 Support Group:*  
https://chat.whatsapp.com/IGgPW6pTrH14oAWCJALYR5?mode=ac_c

——————

> *© Powered by Whiteshadow-MD*
Stay cool and hack smart ✌️
`;

                    await sock.sendMessage(sock.user.id, {
                        text: infoMsg,
                        contextInfo: {
                            externalAdReply: {
                                title: "Whiteshadow-MD",
                                thumbnailUrl: "https://files.catbox.moe/fyr37r.jpg",
                                sourceUrl: "https://heroku.com/deploy?template=https://github.com/cnw-db/Whiteshadow-vx.git",
                                mediaType: 1,
                                renderLargerThumbnail: true
                            }
                        }
                    }, { quoted: sessionMsg });

                    await delay(10);
                    await sock.ws.close();
                    removeFile('./temp/' + id);
                    console.log(`👤 ${sock.user.id} Connected ✅ Restarting process...`);
                    process.exit();

                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10);
                    WHITESHADOW_PAIR_CODE();
                }
            });

        } catch (err) {
            console.log("Service restarted due to error", err);
            removeFile('./temp/' + id);
            if (!res.headersSent) await res.send({ code: "❗ Service Unavailable" });
        }
    }

    return await WHITESHADOW_PAIR_CODE();
});

module.exports = router;
