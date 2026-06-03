const express = require("express");
const mysql = require("mysql2");
const mqtt = require("mqtt");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// --- ENGINE SATELIT BACKEND ---
let chanceOfRainSatelit = 0;
const OWM_API_KEY = "4f1f5b962de78f3c73a8992ae9f3dd08";
const CITY = "Benowo, Surabaya";

const DEVICE_ID = process.env.DEFAULT_DEVICE_ID || "ESP32-NodeMCU";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SETTINGS_PIN = process.env.SETTINGS_PIN || "";

const fetchWeatherSatelit = async () => {
  try {
    const res = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?q=${CITY},id&appid=${OWM_API_KEY}&units=metric&lang=id`,
    );
    chanceOfRainSatelit = Math.round(res.data.list[0].pop * 100);
  } catch (error) {
    console.error("❌ Gagal ambil data satelit:", error.message);
  }
};
fetchWeatherSatelit();
setInterval(fetchWeatherSatelit, 600000);

// --- KONEKSI DB ---
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "iot_smartvillage",
});
db.connect((err) => {
  if (err) console.error("❌ Gagal konek DB:", err);
  else console.log("✅ Database MySQL Terhubung!");
});

// --- VARIABEL CACHE & ANTI-SPAM ---
let liveLogsCache = [];
let waktuSimpanTerakhir = 0;
const JEDA_SIMPAN_DB = 5 * 60 * 1000;

// Variabel Jeda Waktu Notifikasi (Cooldown per tingkat per jenis peringatan)
const lastNotifSended = {};
const NOTIF_COOLDOWN = {
  Waspada: 60 * 60 * 1000,
  Bahaya: 15 * 60 * 1000,
};

const computeDewPointC = (tempC, humidity) => {
  if (tempC == null || humidity == null) return null;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
  return (b * alpha) / (a - alpha);
};

// --- MQTT & LOGIKA ---
const client = mqtt.connect("mqtt://broker.hivemq.com");
client.on("connect", () => {
  console.log("✅ Terhubung ke Broker MQTT HiveMQ");
  client.subscribe("smartvillage/sawah/1");
});

client.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const titikEmbun = computeDewPointC(data.suhu, data.kelembaban);

    // 1. UPDATE DATA REAL-TIME KE RAM
    const logBaru = {
      id: Date.now(),
      suhu: data.suhu,
      kelembaban: data.kelembaban,
      titik_embun: titikEmbun != null ? Number(titikEmbun.toFixed(2)) : null,
      cahaya: data.cahaya,
      hujan: data.hujan,
      waktu: new Date(),
    };
    liveLogsCache.unshift(logBaru);
    if (liveLogsCache.length > 20) liveLogsCache.pop();

    // 2. CEK SKENARIO PERINGATAN BENCANA
    db.query(
      "SELECT * FROM tabel_pengaturan WHERE id_perangkat = ?",
      [DEVICE_ID],
      (err, settings) => {
        if (err || settings.length === 0) return;
        const threshold = settings[0];

        // --- FUNGSI CATAT PERINGATAN (INTEGRASI TELEGRAM BOT) ---
        const catatPeringatan = (tingkat, jenis, pemicu) => {
          // A. SIMPAN KE DATABASE
          db.query(
            "INSERT INTO tabel_peringatan (tingkat, jenis_peringatan, pemicu) VALUES (?, ?, ?)",
            [tingkat, jenis, pemicu],
          );

          // B. KIRIM TELEGRAM DENGAN SISTEM ANTI-SPAM
          const waktuSekarang = Date.now();
          const cooldownMs = NOTIF_COOLDOWN[tingkat] || NOTIF_COOLDOWN.Waspada;
          const cooldownKey = `${tingkat}:${jenis}`;
          if (
            !lastNotifSended[cooldownKey] ||
            waktuSekarang - lastNotifSended[cooldownKey] >= cooldownMs
          ) {
            const pesanTelegram = `🚨 *PERINGATAN DINI EWS* 🚨\n\nSistem Smart Village mendeteksi kondisi ekstrim di lahan sawah:\n\n*Status:* ${tingkat.toUpperCase()}\n*Kategori:* ${jenis}\n*Detail Sensor:* ${pemicu}\n\n_Mohon segera lakukan pengecekan pada dashboard IoT Smart Village!_`;
            const chatId = threshold.telegram_chat_id;

            if (!TELEGRAM_BOT_TOKEN || !chatId) {
              console.warn("⚠️ Telegram token/chat ID belum diatur.");
            } else {
              axios
                .post(
                  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                  {
                    chat_id: chatId,
                    text: pesanTelegram,
                    parse_mode: "Markdown",
                  },
                )
                .then(() => {
                  console.log(
                    `✅ Telegram Terkirim: Peringatan ${tingkat} (${jenis})`,
                  );
                })
                .catch((err) => {
                  console.error("❌ Gagal kirim Telegram:", err.message);
                });
            }

            // Catat waktu pengiriman terakhir
            lastNotifSended[cooldownKey] = waktuSekarang;
          }
        };

        // KONDISI 1: Waspada Dehidrasi Lahan
        if (
          data.suhu >= threshold.suhu_waspada &&
          data.cahaya >= threshold.cahaya_waspada &&
          data.kelembaban <= threshold.kelembaban_kritis
        ) {
          catatPeringatan(
            "Waspada",
            "Risiko Dehidrasi Lahan",
            `Suhu ${data.suhu}°C, Cahaya ${data.cahaya}%, Kelembaban Lahan Kritis ${data.kelembaban}%`,
          );
        }

        // KONDISI 2: Anomali Cuaca Mikro (Bahaya)
        if (
          chanceOfRainSatelit > threshold.peluang_hujan_batas &&
          data.hujan <= threshold.hujan_lebat
        ) {
          catatPeringatan(
            "Bahaya",
            "Anomali Cuaca Mikro",
            `Satelit Prediksi Hujan ${chanceOfRainSatelit}%, namun Kondisi Sensor Lahan Kering`,
          );
        }

        // KONDISI 3: Hujan Lokal (Bahaya)
        if (
          data.hujan > threshold.hujan_lebat &&
          chanceOfRainSatelit <= threshold.peluang_hujan_batas
        ) {
          catatPeringatan(
            "Bahaya",
            "Hujan Lokal",
            `Sensor Mendeteksi Hujan Lebat (${data.hujan}%), padahal Satelit Deteksi Peluang Rendah (${chanceOfRainSatelit}%)`,
          );
        }

        // KONDISI 4: Risiko Penyakit Jamur (Blas) dari Titik Embun
        const selisihTitikEmbun =
          titikEmbun != null
            ? Number((data.suhu - titikEmbun).toFixed(2))
            : null;

        if (
          titikEmbun != null &&
          titikEmbun >= threshold.titik_embun_waspada && // <-- Update disini
          selisihTitikEmbun <= threshold.selisih_suhu_embun // <-- Update disini
        ) {
          catatPeringatan(
            "Waspada",
            "Risiko Penyakit Jamur (Blas)",
            `Titik Embun ${titikEmbun.toFixed(1)}°C, Suhu ${data.suhu}°C (Selisih ${selisihTitikEmbun}°C)`,
          );
        }

        db.query(
          "UPDATE tabel_pengaturan SET status_koneksi = TRUE WHERE id_perangkat = ?",
          [DEVICE_ID],
        );

        // 3. SIMPAN KE DATABASE (HISTORI LOG PER 5 MENIT)
        const waktuSekarangLog = Date.now();
        if (waktuSekarangLog - waktuSimpanTerakhir >= JEDA_SIMPAN_DB) {
          db.query(
            "INSERT INTO sensor_logs (suhu, kelembaban, titik_embun, cahaya, hujan) VALUES (?, ?, ?, ?, ?)",
            [
              data.suhu,
              data.kelembaban,
              titikEmbun != null ? Number(titikEmbun.toFixed(2)) : null,
              data.cahaya,
              data.hujan,
            ],
          );
          waktuSimpanTerakhir = waktuSekarangLog;
        }
      },
    );
  } catch (err) {}
});

// --- API ENDPOINTS ---
app.get("/api/logs/live", (req, res) => res.json(liveLogsCache));

app.get("/api/logs/history", (req, res) => {
  db.query("SELECT * FROM sensor_logs ORDER BY waktu DESC", (err, results) =>
    res.json(results),
  );
});

app.get("/api/settings", (req, res) => {
  db.query(
    "SELECT * FROM tabel_pengaturan WHERE id_perangkat = ?",
    [DEVICE_ID],
    (err, results) => res.json(results[0]),
  );
});

app.put("/api/settings", (req, res) => {
  const {
    suhu_waspada,
    kelembaban_kritis,
    cahaya_waspada,
    hujan_lebat,
    peluang_hujan_batas,
    telegram_chat_id,
    pin,
    titik_embun_waspada,
    selisih_suhu_embun,
  } = req.body;
  if (!SETTINGS_PIN) {
    return res
      .status(500)
      .json({ error: "PIN belum dikonfigurasi di server." });
  }
  if (pin !== SETTINGS_PIN) {
    return res.status(403).json({ error: "PIN tidak valid." });
  }
  db.query(
    "UPDATE tabel_pengaturan SET suhu_waspada = ?, kelembaban_kritis = ?, cahaya_waspada = ?, hujan_lebat = ?, peluang_hujan_batas = ?, telegram_chat_id = ?, titik_embun_waspada = ?, selisih_suhu_embun = ? WHERE id_perangkat = ?",
    [
      suhu_waspada,
      kelembaban_kritis,
      cahaya_waspada,
      hujan_lebat,
      peluang_hujan_batas,
      telegram_chat_id,
      titik_embun_waspada,
      selisih_suhu_embun,
      DEVICE_ID,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    },
  );
});

app.get("/api/alerts", (req, res) => {
  db.query(
    "SELECT * FROM tabel_peringatan ORDER BY waktu_kejadian DESC",
    (err, results) => res.json(results),
  );
});

app.listen(5000, () => console.log("🚀 Server EWS jalan di port 5000"));
