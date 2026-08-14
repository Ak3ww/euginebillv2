/**
 * EugineBill Radius — Baileys Native WhatsApp Service
 * Runs as a standalone Express server (PM2 process: EugineBill-wa)
 * Listens on 127.0.0.1:${WA_SERVICE_PORT} (default 4000)
 *
 * Endpoints:
 *   GET  /status   - connection status
 *   GET  /qr       - QR code as data URI (for scanning)
 *   POST /send     - send WhatsApp message { phone, message }
 *   POST /restart  - logout and reconnect (new QR)
 */

const express = require('express');
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());

const PORT = process.env.WA_SERVICE_PORT || 4000;
const AUTH_DIR = process.env.WA_AUTH_DIR || path.join(__dirname, '.baileys_auth');

let sock = null;
let qrCodeImage = null;
let connectionStatus = 'initializing';
let myNumber = null;

// Silent logger — no noise in PM2 logs except our console.log calls
const logger = pino({ level: 'silent' });

// Auto-restart on corrupted session (Bad MAC)
let badMacCount = 0;
const originalConsoleError = console.error;
console.error = function (...args) {
  if (args.some(a => typeof a === 'string' && (a.includes('Bad MAC') || a.includes('Failed to decrypt')))) {
    badMacCount++;
    if (badMacCount >= 3) {
       originalConsoleError('[WA Service] 🛑 CRITICAL: Multiple Bad MAC / Encryption errors detected. Session is corrupted. Forcing auto-logout...');
       badMacCount = 0;
       connectionStatus = 'error'; // Set to error so UI shows 'Device Terputus'
       if (sock) {
         try { sock.logout('Corrupted session').catch(() => {}); } catch {}
       }
       try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}
       sock = null;
    }
  }
  originalConsoleError.apply(console, args);
};

async function connectToWhatsApp() {
  connectionStatus = 'initializing';
  qrCodeImage = null;
  badMacCount = 0; // reset on new connection

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[WA Service] Baileys v${version.join('.')}, isLatest: ${isLatest}`);

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 30000,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('[WA Service] QR Code generated — awaiting scan...');
      qrCodeImage = await QRCode.toDataURL(qr);
      connectionStatus = 'qr';
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(
        '[WA Service] Connection closed:',
        lastDisconnect?.error?.message || 'unknown',
        '| reconnect:',
        shouldReconnect,
      );

      if (shouldReconnect) {
        connectionStatus = 'reconnecting';
        setTimeout(connectToWhatsApp, 5000);
      } else {
        console.log('[WA Service] Logged out — deleting session...');
        connectionStatus = 'logged_out';
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch { }
        sock = null;
      }
    } else if (connection === 'open') {
      console.log('[WA Service] ✅ Connected to WhatsApp!');
      connectionStatus = 'connected';
      qrCodeImage = null;
      if (sock?.user?.id) {
        myNumber = sock.user.id.split(':')[0].split('@')[0];
        console.log('[WA Service] Phone:', myNumber);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// Start on launch
connectToWhatsApp().catch(err => {
  console.error('[WA Service] Startup error:', err);
  connectionStatus = 'error';
});

// ─── API Routes ──────────────────────────────────────────────────────────────

// Health / status
app.get('/status', (_req, res) => {
  res.json({
    status: connectionStatus,
    connected: connectionStatus === 'connected',
    phone: myNumber,
  });
});

// QR Code (Base64 data URI)
app.get('/qr', (_req, res) => {
  if (connectionStatus === 'connected') {
    return res.status(422).json({
      status: 'ALREADY_LOGGED_IN',
      message: 'Device sudah tersambung!',
      alreadyConnected: true,
    });
  }

  // Auto-restart if session was logged out or errored — so user just needs to click QR
  if (connectionStatus === 'logged_out' || connectionStatus === 'error') {
    console.log(`[WA Service] Auto-restarting from state '${connectionStatus}' on QR request...`);
    connectionStatus = 'initializing';
    qrCodeImage = null;
    connectToWhatsApp().catch(err => console.error('[WA Service] Auto-restart error:', err));
  }

  if (!qrCodeImage) {
    return res.status(400).json({
      status: 'WAITING',
      message: 'QR Code sedang dibuat, silakan coba lagi beberapa detik.',
    });
  }

  // Wrapped in MPWA-compatible format so the UI can handle it uniformly
  res.json({ status: 'qrcode', qrcode: qrCodeImage });
});

// Send message
app.post('/send', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ status: false, message: 'Phone and message are required' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({
      status: false,
      message: `WhatsApp is not connected (status: ${connectionStatus})`,
    });
  }

  try {
    // Normalise to JID
    let rawDigits = phone.replace(/[^0-9]/g, '');
    if (rawDigits.startsWith('620')) rawDigits = '62' + rawDigits.substring(3);
    else if (rawDigits.startsWith('0')) rawDigits = '62' + rawDigits.substring(1);
    else if (rawDigits.startsWith('8')) rawDigits = '62' + rawDigits;
    else if (!rawDigits.startsWith('62')) rawDigits = '62' + rawDigits;

    const jid = rawDigits + '@s.whatsapp.net';

    // Verify the number is on WhatsApp
    try {
      const [result] = await sock.onWhatsApp(jid);
      if (!result || !result.exists) {
        console.warn(`[WA Service] Blocked: onWhatsApp reported ${rawDigits} does not exist on WhatsApp.`);
        return res.status(400).json({ status: false, message: 'Nomor tidak terdaftar di WhatsApp' });
      }
    } catch (e) {
      console.warn(`[WA Service] onWhatsApp check skipped due to error:`, e);
    }

    await sock.sendMessage(jid, { text: message });
    res.json({ status: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('[WA Service] Send error:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to send message: ' + (error.message || 'Unknown error'),
    });
  }
});

// Restart / logout session — triggers new QR
app.post('/restart', async (req, res) => {
  console.log('[WA Service] Restart requested...');
  try {
    if (sock) {
      try { await sock.logout('Restart requested'); } catch { }
    }
    try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch { }
  } catch (e) {
    console.error('[WA Service] Restart cleanup error:', e);
  }

  connectionStatus = 'initializing';
  qrCodeImage = null;
  sock = null;

  setTimeout(() => {
    connectToWhatsApp().catch(err => console.error('[WA Service] Reconnect error:', err));
  }, 2000);

  res.json({ success: true, message: 'Session restarted — scan new QR code' });
});

// Send image/media message (supports personal JID or group JID)
app.post('/send-image', async (req, res) => {
  const { to, imageUrl, caption } = req.body;

  if (!to || !imageUrl) {
    return res.status(400).json({ status: false, message: 'to and imageUrl are required' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({
      status: false,
      message: `WhatsApp is not connected (status: ${connectionStatus})`,
    });
  }

  try {
    // Determine JID — if it contains '@g.us' or '@s.whatsapp.net', use as-is
    let jid = to;
    if (!jid.includes('@')) {
      // Personal number normalisation
      let rawDigits = to.replace(/[^0-9]/g, '');
      if (rawDigits.startsWith('620')) rawDigits = '62' + rawDigits.substring(3);
      else if (rawDigits.startsWith('0')) rawDigits = '62' + rawDigits.substring(1);
      else if (rawDigits.startsWith('8')) rawDigits = '62' + rawDigits;
      else if (!rawDigits.startsWith('62')) rawDigits = '62' + rawDigits;
      jid = rawDigits + '@s.whatsapp.net';
    }

    await sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || '',
    });

    res.json({ status: true, message: 'Image sent successfully' });
  } catch (error) {
    console.error('[WA Service] Send image error:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to send image: ' + (error.message || 'Unknown error'),
    });
  }
});

// Send text message to a group JID directly (no onWhatsApp check for groups)
app.post('/send-group', async (req, res) => {
  const { groupId, message } = req.body;

  if (!groupId || !message) {
    return res.status(400).json({ status: false, message: 'groupId and message are required' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({
      status: false,
      message: `WhatsApp is not connected (status: ${connectionStatus})`,
    });
  }

  try {
    // Group JID must end with @g.us
    const jid = groupId.includes('@') ? groupId : groupId + '@g.us';
    await sock.sendMessage(jid, { text: message });
    res.json({ status: true, message: 'Group message sent successfully' });
  } catch (error) {
    console.error('[WA Service] Send group error:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to send group message: ' + (error.message || 'Unknown error'),
    });
  }
});

// List joined WhatsApp groups (for admin to find group IDs)
app.get('/groups', async (_req, res) => {
  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ status: false, message: 'Not connected' });
  }
  try {
    const allChats = await sock.groupFetchAllParticipating();
    const groups = Object.entries(allChats).map(([id, g]) => ({
      id,
      name: g.subject || 'Unknown Group',
      participants: g.participants?.length || 0,
    }));
    res.json({ status: true, groups });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[WA Service] Listening on http://127.0.0.1:${PORT}`);
});
