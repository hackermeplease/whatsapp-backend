require("dotenv").config();
const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");

const { createPairingSession } = require("./src/services/pairingService");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // IMPORTANT for frontend calls
app.use(express.json());

// In-memory status store (simple + works)
const sessionStatus = new Map(); // userId -> { status, qrDataURL, updatedAt }

app.get("/", (req, res) => {
  res.send("WhatsApp Backend Running 🚀");
});

// Lovable can poll this to know backend is alive
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// ✅ Lovable endpoint: /api/pair
// Returns qrDataURL so your frontend can show QR image
app.get("/api/pair", async (req, res) => {
  try {
    const userId = req.query.userId || req.query.phone; // support both
    if (!userId) return res.status(400).json({ error: "userId (or phone) is required" });

    sessionStatus.set(userId, { status: "starting", qrDataURL: null, updatedAt: Date.now() });

    const sock = await createPairingSession(userId);

    // Wait up to 15s for QR, then respond
    const result = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("QR not generated in time (15s). Try again.")), 15000);

      sock.ev.on("connection.update", async (update) => {
        const { qr, connection } = update;

        if (qr) {
          clearTimeout(t);
          const qrDataURL = await QRCode.toDataURL(qr);

          sessionStatus.set(userId, { status: "qr", qrDataURL, updatedAt: Date.now() });

          resolve({ qrDataURL });
        }

        if (connection === "open") {
          sessionStatus.set(userId, { status: "connected", qrDataURL: null, updatedAt: Date.now() });
        }

        if (connection === "close") {
          // WhatsApp may close before scan; we keep it as "disconnected" for UI
          const cur = sessionStatus.get(userId);
          if (!cur || cur.status !== "connected") {
            sessionStatus.set(userId, { status: "disconnected", qrDataURL: cur?.qrDataURL || null, updatedAt: Date.now() });
          }
        }
      });
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to start pairing" });
  }
});

// ✅ Lovable endpoint: /api/status
app.get("/api/status", (req, res) => {
  const userId = req.query.userId || req.query.phone;
  if (!userId) return res.status(400).json({ error: "userId (or phone) is required" });

  const s = sessionStatus.get(userId) || { status: "idle", qrDataURL: null, updatedAt: null };
  res.json({ success: true, ...s });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));