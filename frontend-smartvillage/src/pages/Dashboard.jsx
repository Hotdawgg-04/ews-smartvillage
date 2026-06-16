import { useState, useEffect } from "react";
import api from "../api";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Thermometer,
  Droplets,
  Sun,
  CloudRain,
  ArrowUp,
  ArrowDown,
  Cloud,
  Calendar,
  Clock,
  CloudLightning,
  CloudDrizzle,
  CloudSun,
  Moon,
  AlertTriangle,
  CheckCircle,
  Leaf,
  Lightbulb,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  FaTemperatureHigh,
  FaTint,
  FaSun,
  FaCloud,
  FaCloudSun,
  FaCloudSunRain,
  FaCloudRain,
  FaCloudShowersHeavy,
  FaSmog,
  FaBolt,
} from "react-icons/fa";

function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [latestData, setLatestData] = useState(null);
  const [analytics, setAnalytics] = useState({
    maxTemp: 0,
    minTemp: 0,
    avgLight: 0,
    avgHum: 0,
    tempTrend: "tetap",
  });
  const [forecast, setForecast] = useState(null);
  const [scrollForecast, setScrollForecast] = useState([]);
  const [forecastView, setForecastView] = useState("hourly");
  const [currentWeather, setCurrentWeather] = useState(null);

  // State untuk menyimpan ambang batas dari Database
  const [thresholds, setThresholds] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const OWM_API_KEY = import.meta.env.VITE_OWM_API_KEY;
  const WEATHER_CITY = "Benowo, Surabaya";
  const DISPLAY_LOCATION = "Kandangan, Kec. Benowo";
  const CASE_LABEL = "Pertanian Sawah (Padi)";

  const fetchSettings = async () => {
    try {
      const res = await api.get("/api/settings");
      setThresholds(res.data);
    } catch (err) {
      console.error("Gagal load setting", err);
    }
  };

  const fetchData = async () => {
    try {
      const response = await api.get("/api/logs/live");
      const data = response.data;
      if (data.length > 0) {
        setLatestData(data[0]);
        setLogs(
          [...data].reverse().map((item) => {
            const d = new Date(item.waktu);
            return {
              ...item,
              jam: `${d.getHours()}:${d.getMinutes() < 10 ? "0" : ""}${d.getMinutes()}`,
            };
          }),
        );
        setAnalytics({
          maxTemp: Math.max(...data.map((d) => d.suhu)),
          minTemp: Math.min(...data.map((d) => d.suhu)),
          avgLight: (
            data.reduce((a, c) => a + c.cahaya, 0) / data.length
          ).toFixed(1),
          avgHum: (
            data.reduce((a, c) => a + c.kelembaban, 0) / data.length
          ).toFixed(1),
          tempTrend:
            data.length > 1 && data[0].suhu !== data[1].suhu
              ? data[0].suhu > data[1].suhu
                ? "naik"
                : "turun"
              : "tetap",
        });
      }
    } catch (error) {}
  };

  const fetchWeatherApi = async () => {
    try {
      const res = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast?q=${WEATHER_CITY},id&appid=${OWM_API_KEY}&units=metric&lang=id`,
      );
      const chanceOfRain = Math.round(res.data.list[0].pop * 100);
      const currentBlock = res.data.list[0];
      setCurrentWeather({
        temp: Math.round(currentBlock.main.feels_like),
        main: currentBlock.weather[0].main,
        description: currentBlock.weather[0].description,
      });
      const next5Days = res.data.list.filter((item) =>
        item.dt_txt.includes("12:00:00"),
      );

      const list3Hourly = res.data.list;
      const hourly24Points = [];
      for (let i = 0; i < 24; i++) {
        const targetDate = new Date();
        targetDate.setHours(targetDate.getHours() + i, 0, 0, 0);
        const targetUnix = Math.floor(targetDate.getTime() / 1000);
        let lowerBlock = list3Hourly[0],
          upperBlock = list3Hourly[0];

        for (let j = 0; j < list3Hourly.length - 1; j++) {
          if (
            targetUnix >= list3Hourly[j].dt &&
            targetUnix <= list3Hourly[j + 1].dt
          ) {
            lowerBlock = list3Hourly[j];
            upperBlock = list3Hourly[j + 1];
            break;
          }
        }
        if (targetUnix > list3Hourly[list3Hourly.length - 1].dt) {
          lowerBlock = list3Hourly[list3Hourly.length - 2];
          upperBlock = list3Hourly[list3Hourly.length - 1];
        }

        const timeDiff = upperBlock.dt - lowerBlock.dt;
        const factor =
          timeDiff === 0 ? 0 : (targetUnix - lowerBlock.dt) / timeDiff;
        const interpolatedSuhu =
          lowerBlock.main.temp +
          (upperBlock.main.temp - lowerBlock.main.temp) * factor;
        const interpolatedPop =
          lowerBlock.pop + (upperBlock.pop - lowerBlock.pop) * factor;

        const chosenBlock =
          Math.abs(targetUnix - lowerBlock.dt) <
          Math.abs(upperBlock.dt - targetUnix)
            ? lowerBlock
            : upperBlock;

        hourly24Points.push({
          jam: i === 0 ? "Sekarang" : `${targetDate.getHours()}:00`,
          hari: targetDate.toLocaleDateString("id-ID", { weekday: "short" }),
          suhu: Math.round(interpolatedSuhu),
          icon: chosenBlock.weather[0].main,
          deskripsi: chosenBlock.weather[0].description,
          peluangHujan: Math.round(interpolatedPop * 100),
        });
      }
      setForecast({ chanceOfRain, next5Days });
      setScrollForecast(hourly24Points);
    } catch (error) {
      console.error("❌ Gagal ambil data satelit di Frontend:", error);
    }
  };

  // --- ENGINE LOGIKA PERINGATAN (DIHUBUNGKAN KE DATABASE) ---
  useEffect(() => {
    if (!latestData || !forecast || !thresholds) return;

    const activeWarnings = [];
    const dewPointValue = Number(latestData.titik_embun ?? 0);
    const dewPointSpread = Number((latestData.suhu - dewPointValue).toFixed(2));

    // 1. [WASPADA] Skenario 2: Risiko Dehidrasi Lahan
    if (
      latestData.suhu > thresholds.suhu_waspada &&
      latestData.cahaya > thresholds.cahaya_waspada &&
      latestData.kelembaban < thresholds.kelembaban_kritis
    ) {
      activeWarnings.push({
        id: "dehidrasi",
        tipe: "warning",
        judul: "Risiko Dehidrasi Lahan Ekstrem",
        deskripsi: `Kombinasi suhu tinggi (>${thresholds.suhu_waspada}°C), cahaya terik (>${thresholds.cahaya_waspada}%), dan kelembaban rendah (<${thresholds.kelembaban_kritis}%) memicu evapotranspirasi cepat.`,
        rekomendasi:
          "Segera lakukan pengecekan genangan air sawah dan aktifkan pengairan guna mencegah tanah retak.",
      });
    }

    // 2. [BAHAYA] Skenario 3A: Anomali Cuaca Mikro (Satelit Tinggi vs Lapangan Kering)
    if (
      forecast.chanceOfRain > thresholds.peluang_hujan_batas &&
      latestData.hujan <= thresholds.hujan_lebat
    ) {
      activeWarnings.push({
        id: "anomali_kering",
        tipe: "danger",
        judul: "Anomali Cuaca Mikro",
        deskripsi: `Satelit mendeteksi potensi hujan tinggi (${forecast.chanceOfRain}%), namun sensor fisik di lapangan mendeteksi kondisi masih kering total (Batas <${thresholds.hujan_lebat}).`,
        rekomendasi:
          "Disarankan menunda pemupukan kimia terbuka demi menghindari risiko pupuk terbuang jika hujan turun lokal.",
      });
    }

    // 3. [BAHAYA] Skenario 3B: Hujan Lokal (Fisik Basah vs Satelit Rendah)
    if (
      latestData.hujan > thresholds.hujan_lebat &&
      forecast.chanceOfRain <= thresholds.peluang_hujan_batas
    ) {
      activeWarnings.push({
        id: "anomali_basah",
        tipe: "danger",
        judul: "Hujan Lokal",
        deskripsi: `Sensor fisik mendeteksi hujan turun di sawah, padahal indikator satelit global memperkirakan peluang hujan rendah (${forecast.chanceOfRain}%). Ini fenomena cuaca mikro.`,
        rekomendasi:
          "Segera amankan gabah/hasil panen yang dijemur. Hindari penyemprotan pestisida karena akan terbilas air.",
      });
    }

    // 4. [WASPADA] Risiko Penyakit Jamur (Blas) dari Titik Embun
    if (
      latestData.titik_embun != null &&
      dewPointValue >= thresholds.titik_embun_waspada && // <-- Update disini
      dewPointSpread <= thresholds.selisih_suhu_embun // <-- Update disini
    ) {
      activeWarnings.push({
        id: "dew_point",
        tipe: "warning",
        judul: "Risiko Penyakit Jamur (Blas)",
        deskripsi: `Titik embun tinggi (${dewPointValue.toFixed(1)}°C) dan selisih suhu kecil (${dewPointSpread}°C) meningkatkan kelembaban daun padi.`,
        rekomendasi:
          "Pantau kelembaban lahan, tingkatkan sirkulasi udara, dan jadwalkan penyemprotan fungisida bila diperlukan.",
      });
    }

    setWarnings(activeWarnings);
  }, [latestData, forecast, thresholds]);

  useEffect(() => {
    fetchSettings();
    fetchData();
    fetchWeatherApi();
    const intervalSensor = setInterval(fetchData, 5000);
    const intervalWeather = setInterval(fetchWeatherApi, 600000);
    return () => {
      clearInterval(intervalSensor);
      clearInterval(intervalWeather);
    };
  }, []);

  const getWeatherIcon = (main, size = 24) => {
    switch (main) {
      case "Clear":
        return <Sun size={size} color="#f59e0b" />;
      case "Clouds":
        return <Cloud size={size} color="#94a3b8" />;
      case "Rain":
        return <CloudRain size={size} color="#3b82f6" />;
      case "Drizzle":
        return <CloudDrizzle size={size} color="#60a5fa" />;
      case "Thunderstorm":
        return <CloudLightning size={size} color="#8b5cf6" />;
      default:
        return <CloudSun size={size} color="#64748b" />;
    }
  };

  const normalizeDesc = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const getWeatherIconBold = (main, description, size = 32) => {
    const desc = normalizeDesc(description);

    if (
      desc.includes("kabut") ||
      desc.includes("asap") ||
      desc.includes("berkabut")
    ) {
      return <FaSmog size={size} color="#94a3b8" />;
    }

    if (
      desc.includes("sedikit berawan") ||
      desc.includes("awan tersebar") ||
      desc.includes("awan pecah")
    ) {
      return <FaCloudSun size={size} color="#f59e0b" />;
    }

    if (desc.includes("awan mendung") || desc.includes("mendung")) {
      return <FaCloud size={size} color="#94a3b8" />;
    }

    if (desc.includes("hujan rintik") || desc.includes("gerimis")) {
      return <FaCloudRain size={size} color="#60a5fa" />;
    }

    if (
      desc.includes("hujan lebat") ||
      desc.includes("hujan sangat lebat") ||
      desc.includes("badai")
    ) {
      return <FaCloudShowersHeavy size={size} color="#2563eb" />;
    }

    if (desc.includes("hujan ringan") || desc.includes("hujan sedang")) {
      return <FaCloudSunRain size={size} color="#3b82f6" />;
    }

    switch (main) {
      case "Clear":
        return <FaSun size={size} color="#f59e0b" />;
      case "Clouds":
        return <FaCloud size={size} color="#94a3b8" />;
      case "Rain":
        return <FaCloudRain size={size} color="#3b82f6" />;
      case "Drizzle":
        return <FaCloudShowersHeavy size={size} color="#60a5fa" />;
      case "Thunderstorm":
        return <FaBolt size={size} color="#8b5cf6" />;
      default:
        return <FaCloud size={size} color="#64748b" />;
    }
  };

  const getRainStatus = (value) => {
    if (value > 80) return { text: "Hujan Lebat", color: "#ef4444" };
    if (value > 40) return { text: "Hujan Sedang", color: "#f97316" };
    if (value > 10) return { text: "Gerimis", color: "#3b82f6" };
    return { text: "Kering Total", color: "#22c55e" };
  };

  const formatWeatherLabel = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const getWeatherTone = (main) => {
    switch (String(main || "").toLowerCase()) {
      case "clear":
        return "clear";
      case "rain":
        return "rain";
      case "drizzle":
        return "drizzle";
      case "thunderstorm":
        return "storm";
      case "mist":
      case "fog":
      case "haze":
      case "smoke":
        return "mist";
      case "clouds":
      default:
        return "clouds";
    }
  };

  const tooltipSeries = {
    suhu: { label: "Suhu", color: "#ff6464", unit: "°C" },
    kelembaban: { label: "Kelembaban", color: "#4790fe", unit: "%" },
    cahaya: { label: "Cahaya", color: "#ffb22d", unit: "%" },
  };

  const CustomTooltip = ({ active, label, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div
        style={{
          borderRadius: "14px",
          border: "1px solid var(--tooltip-border)",
          backgroundColor: "var(--tooltip-bg)",
          boxShadow: "var(--tooltip-shadow)",
          padding: "10px 12px",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--tooltip-label)",
            marginBottom: "6px",
          }}
        >
          {label}
        </div>
        {payload.map((item) => {
          const meta = tooltipSeries[item.dataKey] || {};
          const valueColor = meta.color || item.color || "var(--text)";
          const valueUnit = meta.unit || "";

          return (
            <div
              key={item.dataKey}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              <span style={{ color: valueColor }}>
                {meta.label || item.name}
              </span>
              <span style={{ color: valueColor }}>
                {item.value}
                {valueUnit}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  if (!latestData)
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        Memuat Sistem Smart Village...
      </div>
    );
  const rainStatus = getRainStatus(latestData.hujan);
  const lastSyncDate = latestData.waktu ? new Date(latestData.waktu) : null;
  const lastSyncTime = lastSyncDate
    ? lastSyncDate.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--";
  const lastSyncFullDate = lastSyncDate
    ? lastSyncDate.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "--";
  const timeOfDay = (() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 18 || hour < 6) {
      return { label: "Malam", icon: <Moon size={16} /> };
    }
    if (hour >= 12) {
      return { label: "Siang", icon: <Sun size={16} /> };
    }
    return { label: "Pagi", icon: <Sun size={16} /> };
  })();
  const dewPointDisplay =
    latestData.titik_embun != null
      ? Number(latestData.titik_embun).toFixed(1)
      : "--";

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Urbanist, sans-serif",
        backgroundColor: "var(--bg)",
        minHeight: "100vh",
        color: "var(--text)",
      }}
      className="page"
    >
      <header className="dashboard-hero">
        <div>
          <span className="hero-pill">Monitoring Sawah Padi</span>
          <h1
            style={{ fontSize: "32px", margin: "12px 0 6px" }}
            className="hero-title"
          >
            <Leaf size={28} className="hero-title-icon" />
            Dashboard Smart Village
          </h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            {CASE_LABEL} - {DISPLAY_LOCATION}
          </p>
        </div>
        <div className="hero-meta">
          <div className="hero-meta-card">
            Lokasi
            <strong>{DISPLAY_LOCATION}</strong>
          </div>
          <div className="hero-meta-card">
            Tanggal
            <strong>{lastSyncFullDate}</strong>
          </div>
          <div className="hero-meta-card">
            Jam
            <strong>{lastSyncTime}</strong>
          </div>
          <div className="hero-meta-card">
            Waktu
            <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {timeOfDay.icon}
              {timeOfDay.label}
            </strong>
          </div>
        </div>
      </header>

      {/* PUSAT PERINGATAN DINI */}
      <div style={{ maxWidth: "1300px", margin: "0 auto 30px auto" }}>
        {warnings.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              backgroundColor: "var(--success-bg)",
              border: "1px solid var(--success-border)",
              color: "var(--success-text)",
            }}
            className="status-panel"
          >
            <CheckCircle size={28} color="#10b981" />
            <div>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>
                Pusat Peringatan Dini: Kondisi Lahan Aman
              </h4>
              <p
                style={{ margin: "2px 0 0 0", fontSize: "13px", opacity: 0.9 }}
              >
                Tidak ada anomali atau ancaman cuaca ekstrem yang terdeteksi.
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {warnings.map((warn) => (
              <div
                key={warn.id}
                style={{
                  display: "flex",
                  gap: "15px",
                  border: "1px solid",
                  backgroundColor:
                    warn.tipe === "danger"
                      ? "var(--danger-bg)"
                      : "var(--warning-bg)",
                  borderColor:
                    warn.tipe === "danger"
                      ? "var(--danger-border)"
                      : "var(--warning-border)",
                  color:
                    warn.tipe === "danger"
                      ? "var(--danger-text)"
                      : "var(--warning-text)",
                }}
                className="status-panel"
              >
                <AlertTriangle
                  size={32}
                  style={{ flexShrink: 0, marginTop: "2px" }}
                />
                <div>
                  <h4
                    style={{
                      margin: "0 0 5px 0",
                      fontSize: "16px",
                      fontWeight: "800",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {warn.judul}
                  </h4>
                  <p
                    style={{
                      margin: "0 0 10px 0",
                      fontSize: "14px",
                      lineHeight: "1.4",
                      opacity: 0.9,
                    }}
                  >
                    {warn.deskripsi}
                  </p>
                  <div
                    style={{
                      backgroundColor:
                        warn.tipe === "danger"
                          ? "var(--danger-bg)"
                          : "var(--warning-bg)",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      display: "flex",
                      gap: "8px",
                      alignItems: "flex-start",
                    }}
                  >
                    <Lightbulb size={16} style={{ marginTop: "2px" }} />
                    <span>
                      <span style={{ textDecoration: "underline" }}>
                        Rekomendasi Tindakan:
                      </span>{" "}
                      {warn.rekomendasi}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Section 1: KPI Cards --- */}
      <div className="kpi-grid">
        <div
          className={`kpi-card weather-hero-card weather-${getWeatherTone(
            currentWeather?.main,
          )}`}
          style={{
            ...cardStyle,
            textAlign: "left",
          }}
        >
          <div className="weather-hero-top">
            <div>
              <p className="weather-hero-label">Terasa Seperti</p>
              <h2 className="weather-hero-temp">
                {currentWeather?.temp ?? "--"}°C
              </h2>
              <span className="weather-hero-desc">
                {currentWeather
                  ? formatWeatherLabel(currentWeather.description)
                  : "Memuat cuaca"}{" "}
                {currentWeather ? "-" : ""} {WEATHER_CITY}
              </span>
            </div>
            <div className="weather-hero-icon">
              {currentWeather
                ? getWeatherIconBold(
                    currentWeather.main,
                    currentWeather.description,
                    38,
                  )
                : getWeatherIconBold("Clouds", "", 38)}
            </div>
          </div>
          <div className="weather-hero-sensors">
            <div className="sensor-pill temp">
              <FaTemperatureHigh size={18} />
              <span>Suhu</span>
              <strong>{latestData.suhu}°C</strong>
            </div>
            <div className="sensor-pill hum">
              <FaTint size={18} />
              <span>Lembab</span>
              <strong>{latestData.kelembaban}%</strong>
            </div>
            <div className="sensor-pill light">
              <FaSun size={18} />
              <span>Cahaya</span>
              <strong>{latestData.cahaya}%</strong>
            </div>
          </div>
        </div>
        <div
          className="kpi-card"
          style={{ ...cardStyle, borderTop: `4px solid ${rainStatus.color}` }}
        >
          <div className="kpi-icon-wrap">
            <span className="kpi-icon">
              <FaCloudRain color={rainStatus.color} size={26} />
            </span>
          </div>
          <p style={labelStyle}>Sensor Hujan</p>
          <div style={{ margin: "15px 0 5px 0" }}>
            <span
              style={{
                backgroundColor: rainStatus.color,
                color: "white",
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              {rainStatus.text}
            </span>
          </div>
          <div style={subTextStyle}>Status Sensor Fisik</div>
        </div>
        <div
          className="kpi-card"
          style={{
            ...cardStyle,
            borderTop: "4px solid #38bdf8",
          }}
        >
          <div className="kpi-icon-wrap">
            <span className="kpi-icon" style={{ background: "#38bff83b" }}>
              {forecast ? (
                forecast.chanceOfRain >= 60 ? (
                  <FaCloudShowersHeavy color="#38bdf8" size={26} />
                ) : (
                  <FaCloudRain color="#38bdf8" size={26} />
                )
              ) : (
                <FaCloud color="#38bdf8" size={26} />
              )}
            </span>
          </div>
          <p style={labelStyle}>Peluang Hujan (Satelit)</p>
          <h2 style={{ color: "#38bdf8", margin: "5px 0" }}>
            {forecast?.chanceOfRain ?? "--"}%
          </h2>
          <div style={subTextStyle}>Data Satelit Terkini</div>
        </div>
        <div
          className="kpi-card"
          style={{
            ...cardStyle,
            borderTop: "4px solid #8b5cf6",
          }}
        >
          <div className="kpi-icon-wrap">
            <span className="kpi-icon" style={{ background: "#0ea5e926" }}>
              <Thermometer color="#8b5cf6" size={26} />
            </span>
          </div>
          <p style={labelStyle}>Titik Embun</p>
          <h2 style={{ color: "#8b5cf6", margin: "5px 0" }}>
            {dewPointDisplay}°C
          </h2>
          <div style={subTextStyle}>Dew Point (Sensor)</div>
        </div>
      </div>

      {/* --- Section 2: Grafik Realtime & Forecast --- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
          gap: "25px",
          maxWidth: "1300px",
          margin: "auto",
        }}
        className="dashboard-charts"
      >
        <div style={chartContainerStyle} className="chart-shell">
          <h3 style={chartTitleStyle} className="chart-title">
            <LineChartIcon size={20} className="chart-title-icon" />
            Tren Sensor Real-time
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={logs}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(148, 163, 184, 0.3)"
              />
              <XAxis dataKey="jam" fontSize={12} tick={{ fill: "#64748b" }} />
              <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" />
              <Line
                type="monotone"
                dataKey="suhu"
                stroke="#ff6464"
                strokeWidth={3}
                dot={false}
                name="Suhu (°C)"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="titik_embun"
                name="Titik Embun (°C)"
                stroke="#8b5cf6"
                strokeWidth={3}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="kelembaban"
                stroke="#4790fe"
                strokeWidth={3}
                dot={false}
                name="Kelembaban (%)"
              />
              <Line
                type="monotone"
                dataKey="cahaya"
                stroke="#ffb22d"
                strokeWidth={3}
                dot={false}
                name="Cahaya (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div
          style={{
            ...chartContainerStyle,
            display: "flex",
            flexDirection: "column",
          }}
          className="chart-shell"
        >
          <div className="forecast-header">
            <h3 style={chartTitleStyle} className="forecast-title">
              {forecastView === "hourly" ? (
                <>
                  <Clock size={20} />
                  Prakiraan Cuaca 24 Jam (Per Jam)
                </>
              ) : (
                <>
                  <Calendar size={20} />
                  Prakiraan 5 Hari Ke Depan
                </>
              )}
            </h3>
            <div className="forecast-tabs" role="tablist">
              <button
                type="button"
                className={
                  forecastView === "hourly"
                    ? "forecast-tab active"
                    : "forecast-tab"
                }
                onClick={() => setForecastView("hourly")}
              >
                24 Jam
              </button>
              <button
                type="button"
                className={
                  forecastView === "daily"
                    ? "forecast-tab active"
                    : "forecast-tab"
                }
                onClick={() => setForecastView("daily")}
              >
                5 Hari
              </button>
            </div>
          </div>

          {forecastView === "hourly" ? (
            <div
              style={{
                display: "flex",
                overflowX: "auto",
                gap: "15px",
                paddingBottom: "15px",
                flexGrow: 1,
                alignItems: "center",
                scrollbarWidth: "thin",
              }}
              className="forecast-hourly"
            >
              {scrollForecast.map((item, idx) => (
                <div
                  key={idx}
                  className={
                    idx === 0
                      ? "forecast-hour-card active"
                      : "forecast-hour-card"
                  }
                >
                  <span className="forecast-hour-temp">{item.suhu}°</span>
                  <div className="forecast-hour-icon">
                    {getWeatherIconBold(item.icon, item.deskripsi, 34)}
                  </div>
                  <span className="forecast-pop">
                    <Droplets size={14} />
                    {item.peluangHujan}%
                  </span>
                  <span className="forecast-hour-time">{item.jam}</span>
                  <span className="forecast-hour-day">{item.hari}</span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                overflowX: "auto",
                gap: "15px",
                paddingBottom: "15px",
                flexGrow: 1,
                alignItems: "center",
                scrollbarWidth: "thin",
              }}
              className="forecast-hourly"
            >
              {forecast?.next5Days.map((day, idx) => {
                const date = new Date(day.dt * 1000);
                const pop = Math.round(day.pop * 100);
                return (
                  <div
                    key={idx}
                    className={
                      idx === 0
                        ? "forecast-hour-card active"
                        : "forecast-hour-card"
                    }
                  >
                    <span className="forecast-hour-temp">
                      {Math.round(day.main.temp)}°
                    </span>
                    <div className="forecast-hour-icon">
                      {getWeatherIconBold(
                        day.weather[0].main,
                        day.weather[0].description,
                        34,
                      )}
                    </div>
                    <span className="forecast-pop">
                      <Droplets size={14} />
                      {pop}%
                    </span>
                    <span className="forecast-hour-time">
                      {date.toLocaleDateString("id-ID", { weekday: "long" })}
                    </span>
                    <span className="forecast-hour-desc">
                      {day.weather[0].description}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Styles ---
const cardStyle = {
  borderRadius: "20px",
  width: "100%",
  textAlign: "center",
  transition: "all 0.3s ease",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};
const labelStyle = {
  color: "var(--text-muted)",
  fontSize: "14px",
  margin: "10px 0 5px 0",
  fontWeight: "500",
};
const subTextStyle = {
  fontSize: "12px",
  color: "var(--text-muted)",
  marginTop: "5px",
  fontWeight: "600",
  backgroundColor: "var(--surface-2)",
  padding: "4px 8px",
  borderRadius: "8px",
};
const chartContainerStyle = {
  padding: "24px",
  borderRadius: "20px",
  position: "relative",
  overflow: "hidden",
};
const chartTitleStyle = {
  margin: "0 0 20px 0",
  fontSize: "18px",
  color: "var(--text)",
  fontWeight: "700",
};
 = {
  padding: "15px",
  borderRadius: "12px",const forecastItemStyle
};

export default Dashboard;
