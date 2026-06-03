import { useState, useEffect } from "react";
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
  Calendar,
  Download,
  Filter,
  Table,
  RefreshCw,
  Thermometer,
  Droplets,
  Sun,
  LineChart as LineChartIcon,
  BarChart3,
} from "lucide-react";

function RiwayatData() {
  const [allData, setAllData] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [timeFilter, setTimeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 1. Fungsi Mengambil Data Historis Lengkap dari API yang baru
  const fetchHistoricalData = async () => {
    setIsLoading(true);
    try {
      // Mengambil dari Endpoint /history yang tidak di-limit
      const response = await axios.get(
        "http://192.168.100.101:5000/api/logs/history",
      );
      const data = response.data;

      const formattedData = [...data].reverse().map((item) => {
        const dateObj = new Date(item.waktu);
        return {
          ...item,
          tanggalFormat: dateObj.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
          }),
          waktuLengkap:
            dateObj.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }) +
            ` - ${dateObj.getHours()}:${dateObj.getMinutes() < 10 ? "0" : ""}${dateObj.getMinutes()}`,
        };
      });

      setAllData(formattedData);
    } catch (error) {
      console.error("Error fetching historical data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Efek Filter Data Sisi Client (Berjalan murni di memori Browser tanpa menyiksa API)
  useEffect(() => {
    if (allData.length === 0) return;

    const sekarang = new Date();
    let hasilFilter = [...allData];

    if (timeFilter === "hari") {
      const batas24Jam = new Date(sekarang.getTime() - 24 * 60 * 60 * 1000);
      hasilFilter = allData.filter(
        (item) => new Date(item.waktu) >= batas24Jam,
      );
    } else if (timeFilter === "minggu") {
      const batas7Hari = new Date(sekarang.getTime() - 7 * 24 * 60 * 60 * 1000);
      hasilFilter = allData.filter(
        (item) => new Date(item.waktu) >= batas7Hari,
      );
    } else if (timeFilter === "bulan") {
      const batas30Hari = new Date(
        sekarang.getTime() - 30 * 24 * 60 * 60 * 1000,
      );
      hasilFilter = allData.filter(
        (item) => new Date(item.waktu) >= batas30Hari,
      );
    }

    setFilteredLogs(hasilFilter);
    setCurrentPage(1);
  }, [timeFilter, allData]);

  // 3. Efek Auto-Refresh (Disesuaikan dengan laju database 5 Menit sekali)
  useEffect(() => {
    fetchHistoricalData();

    // Refresh otomatis setiap 5 Menit (300.000 ms), bukan 5 Detik.
    const interval = setInterval(
      () => {
        fetchHistoricalData();
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, []);

  // --- ENGINE EXPORT CSV ---
  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      alert("Tidak ada data untuk diexport!");
      return;
    }

    const headers = [
      "No",
      "Timestamp/Waktu",
      "Suhu (°C)",
      "Kelembaban (%)",
      "Intensitas Cahaya (%)",
      "Sensor Hujan (Nilai)",
    ];

    const csvRows = [
      headers.join(","),
      ...filteredLogs.map((item, index) =>
        [
          index + 1,
          `"${item.waktuLengkap}"`,
          item.suhu,
          item.kelembaban,
          item.cahaya,
          item.hujan,
        ].join(","),
      ),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);

    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Log_Sensor_SmartVillage_${timeFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);

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

  return (
    <div
      style={{
        padding: "25px",
        fontFamily: "Urbanist, sans-serif",
        backgroundColor: "var(--bg)",
        color: "var(--text)",
      }}
      className="page"
    >
      <header
        style={{
          display: "flex",
          justifyContent: "between",
          alignItems: "center",
          marginBottom: "30px",
          flexWrap: "wrap",
          gap: "15px",
        }}
      >
        <div style={{ flexGrow: 1 }}>
          <h1
            style={{
              fontSize: "28px",
              margin: "0",
              fontWeight: "800",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
            className="section-title"
          >
            <LineChartIcon size={28} className="section-title-icon" />
            Analitik & Riwayat Data
          </h1>
          <p style={{ color: "var(--text-muted)", margin: "5px 0 0 0" }}>
            Big Data Hub — Penyimpanan Historis Log Sensor IoT Lahan Sawah
          </p>
        </div>

        <button
          onClick={fetchHistoricalData}
          style={secondaryBtnStyle}
          disabled={isLoading}
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "Memuat..." : "Refresh Data"}
        </button>
      </header>

      {/* PANEL KONTROL */}
      <div style={panelControlStyle} className="surface-card">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Filter size={20} color="#64748b" />
          <span
            style={{ fontSize: "14px", fontWeight: "700", color: "#475569" }}
          >
            Filter Jangka Waktu:
          </span>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            style={selectStyle}
            className="riwayat-filter-select"
          >
            <option value="all">Semua Riwayat Data</option>
            <option value="hari">24 Jam Terakhir</option>
            <option value="minggu">7 Hari Terakhir</option>
            <option value="bulan">30 Hari Terakhir</option>
          </select>
        </div>

        <button onClick={exportToCSV} style={primaryBtnStyle}>
          <Download size={18} />
          Export ke (.CSV / Excel)
        </button>
      </div>

      {/* GRAFIK HISTORIS JANGKA PANJANG */}
      <div style={chartContainerStyle} className="surface-card">
        <h3 style={sectionTitleStyle} className="section-title">
          <BarChart3 size={20} className="section-title-icon" />
          Grafik Trend Jangka Panjang ({filteredLogs.length} Data Terbaca)
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={filteredLogs}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />
            <XAxis
              dataKey="tanggalFormat"
              fontSize={11}
              tick={{ fill: "#64748b" }}
            />
            <YAxis fontSize={12} tick={{ fill: "#64748b" }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" />
            <Line
              type="monotone"
              dataKey="suhu"
              stroke="#ff6464"
              strokeWidth={2.5}
              dot={filteredLogs.length < 50}
              name="Suhu (°C)"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="titik_embun"
              name="Titik Embun (°C)"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 6 }}
              strokeDasharray="4 4"
            />
            <Line
              type="monotone"
              dataKey="kelembaban"
              stroke="#4790fe"
              strokeWidth={2.5}
              dot={filteredLogs.length < 50}
              name="Kelembaban (%)"
            />
            <Line
              type="monotone"
              dataKey="cahaya"
              stroke="#ffb22d"
              strokeWidth={2.5}
              dot={filteredLogs.length < 50}
              name="Cahaya (%)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TABEL DATA MENTAH */}
      <div style={chartContainerStyle} className="surface-card">
        <h3 style={sectionTitleStyle}>
          <Table
            size={20}
            style={{ verticalAlign: "middle", marginRight: "8px" }}
          />
          Tabel Log Parameter Sensor Fisik Lapangan
        </h3>

        <div
          style={{
            overflowX: "hidden",
            overflowY: "hidden",
            borderRadius: "18px",
            boxShadow: "none",
          }}
          className="riwayat-table-shell"
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "14px",
              tableLayout: "auto",
            }}
            className="riwayat-table"
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--table-head)",
                  color: "var(--table-head-text)",
                }}
              >
                <th style={thStyle}>No</th>
                <th style={thStyle}>Waktu Pengambilan Data</th>
                <th style={thStyle}>
                  <Thermometer size={14} style={iconInTable} /> Suhu
                </th>
                <th style={thStyle}>
                  <Droplets size={14} style={iconInTable} /> Kelembaban
                </th>
                <th style={thStyle}>
                  <Droplets size={14} style={iconInTable} /> Titik Embun
                </th>
                <th style={thStyle}>
                  <Sun size={14} style={iconInTable} /> Intensitas Cahaya
                </th>
                <th style={thStyle}>Sensor Hujan</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                      color: "var(--text-muted)",
                    }}
                  >
                    Tidak ada log data dalam rentang waktu ini.
                  </td>
                </tr>
              ) : (
                currentItems.map((log, index) => (
                  <tr
                    key={log._id || index}
                    style={index % 2 === 0 ? rowGenapStyle : rowGanjilStyle}
                  >
                    <td style={tdStyle}>{indexOfFirstItem + index + 1}</td>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: "600",
                        color: "var(--text)",
                      }}
                    >
                      {log.waktuLengkap}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#ff6464",
                        fontWeight: "700",
                      }}
                    >
                      {log.suhu}°C
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#4790fe",
                        fontWeight: "700",
                      }}
                    >
                      {log.kelembaban}%
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#8b5cf6",
                        fontWeight: "600",
                      }}
                    >
                      {log.titik_embun != null ? `${log.titik_embun}°C` : "-"}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#ffb22d",
                        fontWeight: "700",
                      }}
                    >
                      {log.cahaya}%
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={
                          log.hujan > 10 ? badgeHujanStyle : badgeKeringStyle
                        }
                      >
                        {log.hujan > 80
                          ? "Hujan Lebat"
                          : log.hujan > 40
                            ? "Hujan Sedang"
                            : log.hujan > 10
                              ? "Gerimis"
                              : "Kering"}{" "}
                        ({log.hujan})
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={paginationContainerStyle}>
            <span
              style={{
                fontSize: "14px",
                color: "var(--text-muted)",
                fontWeight: "600",
              }}
            >
              Halaman {currentPage} dari {totalPages}
            </span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={currentPage === 1 ? pageBtnDisabledStyle : pageBtnStyle}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                style={
                  currentPage === totalPages
                    ? pageBtnDisabledStyle
                    : pageBtnStyle
                }
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Gaya Kode (Styles Constants) ---
const panelControlStyle = {
  backgroundColor: "var(--surface)",
  padding: "16px 24px",
  borderRadius: "16px",
  boxShadow: "var(--shadow)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "15px",
  marginBottom: "25px",
};
const selectStyle = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  backgroundColor: "var(--surface-2)",
  fontFamily: "Urbanist, sans-serif",
  fontSize: "14px",
  fontWeight: "600",
  color: "var(--text)",
  outline: "none",
  cursor: "pointer",
};
const primaryBtnStyle = {
  backgroundColor: "var(--primary)",
  color: "var(--primary-contrast)",
  border: "none",
  padding: "10px 18px",
  borderRadius: "12px",
  fontFamily: "Urbanist, sans-serif",
  fontWeight: "700",
  fontSize: "14px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  boxShadow: "var(--shadow)",
};
const secondaryBtnStyle = {
  backgroundColor: "var(--surface)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  padding: "10px 16px",
  borderRadius: "12px",
  fontFamily: "Urbanist, sans-serif",
  fontWeight: "600",
  fontSize: "14px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};
const chartContainerStyle = {
  backgroundColor: "var(--surface)",
  padding: "24px",
  borderRadius: "20px",
  boxShadow: "var(--shadow)",
  marginBottom: "30px",
};
const sectionTitleStyle = {
  margin: "0 0 20px 0",
  fontSize: "18px",
  color: "var(--text)",
  fontWeight: "700",
};
const thStyle = { padding: "14px 16px", fontWeight: "600" };
const tdStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--border)",
};
const rowGenapStyle = { backgroundColor: "var(--surface)" };
const rowGanjilStyle = { backgroundColor: "var(--surface-2)" };
const iconInTable = { verticalAlign: "middle", marginRight: "4px" };
const badgeHujanStyle = {
  backgroundColor: "var(--info-bg)",
  color: "var(--info-text)",
  padding: "4px 8px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: "700",
};
const badgeKeringStyle = {
  backgroundColor: "var(--surface-2)",
  color: "var(--text-muted)",
  padding: "4px 8px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: "600",
};

const paginationContainerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 16px",
  backgroundColor: "var(--surface-2)",
  borderTop: "1px solid var(--border)",
  marginTop: "12px",
  borderRadius: "12px",
};
const pageBtnStyle = {
  padding: "8px 14px",
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--text)",
  fontWeight: "700",
  cursor: "pointer",
  fontSize: "13px",
};
const pageBtnDisabledStyle = {
  ...pageBtnStyle,
  color: "#94a3b8",
  backgroundColor: "var(--surface-2)",
  cursor: "not-allowed",
  border: "1px solid var(--border)",
};

export default RiwayatData;
