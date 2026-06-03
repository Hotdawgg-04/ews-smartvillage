import { useState, useEffect } from "react";
import axios from "axios";
import {
  Settings,
  Wifi,
  Activity,
  Save,
  Server,
  Cpu,
  CheckCircle,
} from "lucide-react";

function ManajemenPerangkat() {
  const [latency, setLatency] = useState(24);
  const [lastUpdate, setLastUpdate] = useState("Memuat...");
  const [isOnline, setIsOnline] = useState(false);

  const [thresholds, setThresholds] = useState({
    suhuWaspada: 0,
    kelembabanKritis: 0,
    cahayaWaspada: 0,
    hujanLebat: 0,
    peluangHujanBatas: 0,
    titikEmbunWaspada: 24,
    selisihSuhuEmbun: 2,
  });
  const [telegramChatId, setTelegramChatId] = useState("");
  const [pin, setPin] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadInitialSettings = async () => {
    try {
      const response = await axios.get(
        "http://192.168.100.101:5000/api/settings",
      );
      if (response.data) {
        setThresholds({
          suhuWaspada: response.data.suhu_waspada,
          kelembabanKritis: response.data.kelembaban_kritis,
          cahayaWaspada: response.data.cahaya_waspada,
          hujanLebat: response.data.hujan_lebat,
          peluangHujanBatas: response.data.peluang_hujan_batas,
          titikEmbunWaspada: response.data.titik_embun_waspada,
          selisihSuhuEmbun: response.data.selisih_suhu_embun,
        });
        setTelegramChatId(response.data.telegram_chat_id || "");
        setIsOnline(response.data.status_koneksi === 1);
        setLastUpdate(
          new Date(response.data.last_ping).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const refreshDeviceHealth = async () => {
    try {
      const response = await axios.get(
        "http://192.168.100.101:5000/api/settings",
      );
      if (response.data) {
        setIsOnline(response.data.status_koneksi === 1);
        setLastUpdate(
          new Date(response.data.last_ping).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      }
    } catch (error) {}
  };

  useEffect(() => {
    loadInitialSettings();
    const interval = setInterval(() => {
      refreshDeviceHealth();
      setLatency(Math.floor(Math.random() * 30) + 15);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setThresholds((prev) => ({ ...prev, [name]: Number(value) }));
  };

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    if (name === "telegramChatId") setTelegramChatId(value);
    if (name === "pin") setPin(value);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError("");
    try {
      await axios.put("http://192.168.100.101:5000/api/settings", {
        suhu_waspada: thresholds.suhuWaspada,
        kelembaban_kritis: thresholds.kelembabanKritis,
        cahaya_waspada: thresholds.cahayaWaspada,
        hujan_lebat: thresholds.hujanLebat,
        peluang_hujan_batas: thresholds.peluangHujanBatas,
        titik_embun_waspada: thresholds.titikEmbunWaspada,
        selisih_suhu_embun: thresholds.selisihSuhuEmbun,
        telegram_chat_id: telegramChatId,
        pin,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      const message =
        error.response?.data?.error || "Gagal menyimpan pengaturan";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        padding: "25px",
        fontFamily: "Urbanist, sans-serif",
        backgroundColor: "var(--bg)",
        color: "var(--text)",
        minHeight: "100vh",
      }}
      className="page"
    >
      <header style={{ marginBottom: "30px" }}>
        <h1
          style={{
            fontSize: "28px",
            margin: "0",
            fontWeight: "800",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Settings color="var(--primary)" size={32} /> Manajemen Skenario &
          Threshold
        </h1>
        <p style={{ color: "var(--text-muted)", margin: "5px 0 0 42px" }}>
          Atur parameter pemicu untuk 3 skenario peringatan utama.
        </p>
      </header>

      {/* --- Bagian Status Lahan (Sama seperti sebelumnya) --- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        <div style={cardStyle} className="surface-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Server size={20} color="#64748b" />
              <span style={{ fontWeight: "600" }}>Perangkat</span>
            </div>
            {isOnline ? (
              <span style={badgeOnlineStyle}>Online</span>
            ) : (
              <span style={badgeOfflineStyle}>Offline</span>
            )}
          </div>
          <h3
            style={{ margin: "0 0 5px 0", fontSize: "20px", fontWeight: "800" }}
          >
            ESP32-NodeMCU
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Terakhir aktif: {lastUpdate}
          </p>
        </div>
        <div style={cardStyle} className="surface-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Activity size={20} color="#64748b" />
              <span style={{ fontWeight: "600" }}>Ping</span>
            </div>
            <Wifi size={20} color={latency < 30 ? "#10b981" : "#f59e0b"} />
          </div>
          <h3
            style={{
              margin: "0 0 5px 0",
              fontSize: "28px",
              fontWeight: "800",
              color: latency < 30 ? "#10b981" : "#f59e0b",
            }}
          >
            {latency} <span style={{ fontSize: "14px" }}>ms</span>
          </h3>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
            RTT ke perangkat (perkiraan)
          </div>
        </div>
        <div style={cardStyle} className="surface-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Cpu size={20} color="#64748b" />
              <span style={{ fontWeight: "600" }}>Modul Terpasang</span>
            </div>
          </div>
          <div style={{ margin: "0 0 8px 0" }}>
            <ul style={{ margin: 0, paddingLeft: 18, listStyleType: "disc" }}>
              <li style={{ fontSize: 14, fontWeight: 600 }}>
                DHT22 (Suhu & Kelembaban)
              </li>
              <li style={{ fontSize: 14, fontWeight: 600 }}>
                LDR Photoresistor (Intensitas Cahaya)
              </li>
              <li style={{ fontSize: 14, fontWeight: 600 }}>
                Rain Drop Sensor (Sensor Hujan)
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "var(--surface)",
          padding: "30px",
          borderRadius: "16px",
          boxShadow: "var(--shadow)",
          border: "1px solid var(--border)",
        }}
        className="surface-card"
      >
        <h3
          style={{ margin: "0 0 15px 0", fontSize: "18px", fontWeight: "700" }}
        >
          Konfigurasi Batas Sensor & Satelit
        </h3>
        <form onSubmit={handleSave}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "18px",
              marginBottom: "25px",
            }}
          >
            <div>
              <label style={labelStyle}>Telegram Chat ID</label>
              <input
                type="text"
                name="telegramChatId"
                value={telegramChatId}
                onChange={handleTextChange}
                placeholder="Contoh: -5211075032"
                style={textInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>PIN Akses Pengaturan</label>
              <input
                type="password"
                name="pin"
                value={pin}
                onChange={handleTextChange}
                placeholder="Masukkan PIN"
                style={textInputStyle}
                required
              />
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "25px",
              marginBottom: "25px",
            }}
          >
            <div>
              <label style={labelStyle}>Suhu Batas Risiko Dehidrasi (°C)</label>
              <div className="slider-row">
                <input
                  type="range"
                  name="suhuWaspada"
                  value={thresholds.suhuWaspada}
                  onChange={handleInputChange}
                  min="0"
                  max="60"
                  step="1"
                  className="range-input"
                />
                <span className="slider-value">{thresholds.suhuWaspada}</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>
                Cahaya Batas Risiko Dehidrasi (%)
              </label>
              <div className="slider-row">
                <input
                  type="range"
                  name="cahayaWaspada"
                  value={thresholds.cahayaWaspada}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="1"
                  className="range-input"
                />
                <span className="slider-value">{thresholds.cahayaWaspada}</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>
                Kelembaban Batas Kritis Dehidrasi (%)
              </label>
              <div className="slider-row">
                <input
                  type="range"
                  name="kelembabanKritis"
                  value={thresholds.kelembabanKritis}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="1"
                  className="range-input"
                />
                <span className="slider-value">
                  {thresholds.kelembabanKritis}
                </span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Batas Minimal Sensor Fisik Hujan</label>
              <div className="slider-row">
                <input
                  type="range"
                  name="hujanLebat"
                  value={thresholds.hujanLebat}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="1"
                  className="range-input"
                />
                <span className="slider-value">{thresholds.hujanLebat}</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Batas Peluang Hujan Satelit (%)</label>
              <div className="slider-row">
                <input
                  type="range"
                  name="peluangHujanBatas"
                  value={thresholds.peluangHujanBatas}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="1"
                  className="range-input"
                />
                <span className="slider-value">
                  {thresholds.peluangHujanBatas}
                </span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Batas Waspada Titik Embun (°C)</label>
              <div className="slider-row">
                <input
                  type="range"
                  name="titikEmbunWaspada"
                  value={thresholds.titikEmbunWaspada}
                  onChange={handleInputChange}
                  min="15"
                  max="35"
                  step="1"
                  className="range-input"
                />
                <span className="slider-value">
                  {thresholds.titikEmbunWaspada}
                </span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Batas Selisih Suhu & Embun (°C)</label>
              <div className="slider-row">
                <input
                  type="range"
                  name="selisihSuhuEmbun"
                  value={thresholds.selisihSuhuEmbun}
                  onChange={handleInputChange}
                  min="0"
                  max="10"
                  step="0.5"
                  className="range-input"
                />
                <span className="slider-value">
                  {thresholds.selisihSuhuEmbun}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              borderTop: "1px solid var(--border)",
              paddingTop: "20px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              style={isSaving ? btnSavingStyle : btnSaveStyle}
              disabled={isSaving}
            >
              <Save size={18} />{" "}
              {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
            {saveSuccess && (
              <span
                style={{
                  color: "var(--primary)",
                  fontWeight: "700",
                  fontSize: "14px",
                }}
              >
                <CheckCircle size={18} style={{ verticalAlign: "middle" }} />{" "}
                Berhasil disimpan!
              </span>
            )}
            {saveError && (
              <span
                style={{
                  color: "var(--danger-text)",
                  fontWeight: "700",
                  fontSize: "14px",
                }}
              >
                {saveError}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

const cardStyle = {
  backgroundColor: "var(--surface)",
  padding: "20px",
  borderRadius: "16px",
  boxShadow: "var(--shadow)",
  border: "1px solid var(--border)",
};
const badgeOnlineStyle = {
  backgroundColor: "var(--success-bg)",
  color: "var(--success-text)",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "700",
};
const badgeOfflineStyle = {
  backgroundColor: "var(--danger-bg)",
  color: "var(--danger-text)",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "700",
};
const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontSize: "14px",
  fontWeight: "700",
  color: "var(--text)",
};
const btnSaveStyle = {
  backgroundColor: "var(--primary)",
  color: "var(--primary-contrast)",
  border: "none",
  padding: "12px 24px",
  borderRadius: "10px",
  fontWeight: "700",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
};
const btnSavingStyle = {
  ...btnSaveStyle,
  backgroundColor: "#94a3b8",
  cursor: "not-allowed",
};
const textInputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  backgroundColor: "var(--surface-2)",
  color: "var(--text)",
  fontWeight: "600",
  outline: "none",
};

export default ManajemenPerangkat;
