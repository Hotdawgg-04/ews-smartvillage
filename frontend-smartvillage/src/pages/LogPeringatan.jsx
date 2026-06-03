import { useState, useEffect } from "react";
import axios from "axios";
import {
  AlertTriangle,
  Clock,
  AlertCircle,
  ShieldAlert,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

function LogPeringatan() {
  const [alerts, setAlerts] = useState([]); // Data asli Anti-Spam
  const [filteredAlerts, setFilteredAlerts] = useState([]); // Data setelah di-filter
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // --- STATE UNTUK FILTER ---
  const [filterWaktu, setFilterWaktu] = useState("all");
  const [filterTingkat, setFilterTingkat] = useState("all");
  const [filterJenis, setFilterJenis] = useState("all");

  // --- STATE UNTUK PAGINATION ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Jumlah baris per halaman

  const handleResetFilter = () => {
    setFilterWaktu("all");
    setFilterTingkat("all");
    setFilterJenis("all");
  };

  const handleExportCsv = () => {
    const rows = filteredAlerts.map((alert) => ({
      waktu: alert.waktu,
      tingkat: alert.tingkat,
      jenis_peringatan: alert.pesan,
      pemicu: alert.pemicu,
    }));

    const header = ["Waktu", "Tingkat", "Jenis Peringatan", "Parameter Pemicu"];
    const csvLines = [
      header.join(","),
      ...rows.map((row) =>
        [row.waktu, row.tingkat, row.jenis_peringatan, row.pemicu]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];

    const blob = new Blob(["\ufeff", csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `riwayat-insiden-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fetchAlertLogs = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await axios.get(
        "http://192.168.100.101:5000/api/alerts",
      );
      const rawData = response.data;

      if (!Array.isArray(rawData)) throw new Error("Format data tidak valid.");

      // =======================================================================
      // 1. ENGINE ANTI-SPAM (PENGELOMPOKAN ALERT BERUNTUN)
      // =======================================================================
      const noSpamData = [];
      const lastSeenTime = {};

      rawData.forEach((item) => {
        const timeMs = new Date(item.waktu_kejadian).getTime();
        const type = item.jenis_peringatan;

        // Karena data dari DB diurutkan DESC (Terbaru ke Terlama),
        // Kita gabungkan alert yang beruntun dalam jeda < 1 Jam menjadi 1 baris log saja
        if (
          !lastSeenTime[type] ||
          lastSeenTime[type] - timeMs > 60 * 60 * 1000
        ) {
          noSpamData.push(item);
        }

        lastSeenTime[type] = timeMs; // Gulung terus alert yang berdekatan
      });

      // 2. Format Data yang sudah bersih dari Spam
      const formattedAlerts = noSpamData.map((item) => {
        const dateObj = new Date(item.waktu_kejadian);
        return {
          id: item.id_peringatan,
          rawDate: dateObj, // Disimpan untuk fungsi filter
          waktu: dateObj.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          tingkat: item.tingkat,
          pesan: item.jenis_peringatan,
          pemicu: item.pemicu,
        };
      });

      setAlerts(formattedAlerts);
    } catch (error) {
      console.error("Error fetching alert data:", error);
      setErrorMsg("Gagal memuat riwayat insiden dari server database.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- ENGINE FILTER & PAGINATION ---
  useEffect(() => {
    let result = [...alerts];
    const sekarang = new Date();

    // 1. Terapkan Filter Waktu
    if (filterWaktu !== "all") {
      result = result.filter((a) => {
        const selisih = sekarang - a.rawDate;
        if (filterWaktu === "hari") return selisih <= 24 * 60 * 60 * 1000;
        if (filterWaktu === "minggu") return selisih <= 7 * 24 * 60 * 60 * 1000;
        if (filterWaktu === "bulan") return selisih <= 30 * 24 * 60 * 60 * 1000;
        return true;
      });
    }

    // 2. Terapkan Filter Tingkat Keparahan
    if (filterTingkat !== "all") {
      result = result.filter((a) => a.tingkat === filterTingkat);
    }

    // 3. Terapkan Filter Jenis Peringatan
    if (filterJenis !== "all") {
      result = result.filter((a) => a.pesan === filterJenis);
    }

    setFilteredAlerts(result);
    setCurrentPage(1); // Selalu kembali ke halaman 1 jika filter diubah
  }, [alerts, filterWaktu, filterTingkat, filterJenis]);

  // Kalkulasi Pagination
  const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredAlerts.slice(indexOfFirstItem, indexOfLastItem);

  // Auto Refresh Data Utama
  useEffect(() => {
    fetchAlertLogs();
    const interval = setInterval(fetchAlertLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Statistik Dinamis
  const waspadaCount = alerts.filter((a) => a.tingkat === "Waspada").length;
  const bahayaCount = alerts.filter((a) => a.tingkat === "Bahaya").length;

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
      {/* Header */}
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
          <AlertTriangle color="#ef4444" size={32} />
          Log Peringatan Dini
        </h1>
        <p style={{ color: "var(--text-muted)", margin: "5px 0 0 42px" }}>
          Riwayat anomali sensor dan peringatan bahaya (Otomatis dibersihkan
          dari log berulang/spam).
        </p>
      </header>

      {errorMsg && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            color: "#b91c1c",
            padding: "15px",
            borderRadius: "10px",
            marginBottom: "20px",
            fontWeight: "600",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Insight Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div style={insightCardStyle} className="surface-card">
          <div
            style={{
              backgroundColor: "#fef08a",
              padding: "12px",
              borderRadius: "12px",
            }}
          >
            <AlertCircle color="#ca8a04" size={24} />
          </div>
          <div>
            <p style={insightLabelStyle}>Total Insiden "Waspada"</p>
            <h3 style={insightValueStyle}>
              {waspadaCount}{" "}
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#64748b",
                }}
              >
                Kejadian
              </span>
            </h3>
          </div>
        </div>

        <div style={insightCardStyle} className="surface-card">
          <div
            style={{
              backgroundColor: "#fecaca",
              padding: "12px",
              borderRadius: "12px",
            }}
          >
            <ShieldAlert color="#ef4444" size={24} />
          </div>
          <div>
            <p style={insightLabelStyle}>Total Insiden "Bahaya"</p>
            <h3 style={insightValueStyle}>
              {bahayaCount}{" "}
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#64748b",
                }}
              >
                Kejadian
              </span>
            </h3>
          </div>
        </div>
      </div>

      {/* ==================== PANEL FILTER ==================== */}
      <div style={filterPanelStyle} className="surface-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontWeight: "700",
            color: "var(--text-muted)",
          }}
        >
          <Filter size={20} /> Filter Data:
        </div>

        <select
          value={filterWaktu}
          onChange={(e) => setFilterWaktu(e.target.value)}
          style={selectStyle}
        >
          <option value="all">Semua Waktu</option>
          <option value="hari">24 Jam Terakhir</option>
          <option value="minggu">7 Hari Terakhir</option>
          <option value="bulan">30 Hari Terakhir</option>
        </select>

        <select
          value={filterTingkat}
          onChange={(e) => setFilterTingkat(e.target.value)}
          style={selectStyle}
        >
          <option value="all">Semua Tingkat</option>
          <option value="Waspada">Tingkat Waspada</option>
          <option value="Bahaya">Tingkat Bahaya</option>
        </select>

        <select
          value={filterJenis}
          onChange={(e) => setFilterJenis(e.target.value)}
          style={selectStyle}
        >
          <option value="all">Semua Jenis Peringatan</option>
          <option value="Risiko Dehidrasi Lahan Ekstrem">
            Dehidrasi Lahan
          </option>
          <option value="Anomali Cuaca Mikro">Anomali Cuaca Mikro</option>
          <option value="Hujan Lokal">Hujan Lokal</option>
          <option value="Risiko Penyakit Jamur (Blas)">
            Risiko Penyakit Jamur (Blas)
          </option>
        </select>

        <button type="button" onClick={handleResetFilter} style={btnResetStyle}>
          Reset Filter
        </button>

        <button type="button" onClick={handleExportCsv} style={btnExportStyle}>
          Export CSV/Excel
        </button>
      </div>

      {/* Tabel Log Peringatan */}
      <div style={tableContainerStyle} className="surface-card">
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>
            Riwayat Insiden ({filteredAlerts.length} Ditemukan)
          </h3>
          {isLoading && (
            <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              Sinkronisasi Database...
            </span>
          )}
        </div>

        <div style={{ overflowX: "auto", minHeight: "450px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text-muted)",
                }}
              >
                <th style={thStyle} className="log-table-time-col">
                  Waktu Kejadian Terakhir
                </th>
                <th style={thStyle}>Tingkat</th>
                <th style={thStyle}>Jenis Peringatan</th>
                <th style={thStyle} className="log-table-trigger-col">
                  Parameter Pemicu
                </th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 && !isLoading && !errorMsg ? (
                <tr>
                  <td
                    colSpan="4"
                    style={{
                      textAlign: "center",
                      padding: "60px",
                      color: "#94a3b8",
                    }}
                  >
                    <ShieldAlert
                      size={48}
                      style={{ margin: "0 auto 10px auto", opacity: 0.3 }}
                    />
                    <p
                      style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}
                    >
                      Tidak ada riwayat log
                    </p>
                    <p style={{ margin: "5px 0 0 0" }}>
                      Belum ada peringatan dengan filter ini yang tercatat di
                      database.
                    </p>
                  </td>
                </tr>
              ) : (
                currentItems.map((alert) => (
                  <tr key={alert.id} style={rowStyle}>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: "600",
                        color: "var(--text)",
                      }}
                      className="log-table-time-col"
                    >
                      <Clock
                        size={14}
                        style={{
                          verticalAlign: "middle",
                          marginRight: "6px",
                          color: "#94a3b8",
                        }}
                      />
                      {alert.waktu}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={
                          alert.tingkat === "Bahaya"
                            ? badgeBahayaStyle
                            : badgeWaspadaStyle
                        }
                      >
                        {alert.tingkat}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: "600" }}>
                      {alert.pesan}
                    </td>
                    <td
                      style={{ ...tdStyle, color: "#64748b" }}
                      className="log-table-trigger-col"
                    >
                      {alert.pemicu}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ==================== KONTROL PAGINATION ==================== */}
        {totalPages > 1 && (
          <div style={paginationContainerStyle}>
            <span
              style={{ fontSize: "14px", color: "#64748b", fontWeight: "600" }}
            >
              Halaman {currentPage} dari {totalPages}
            </span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={currentPage === 1 ? btnPageDisabledStyle : btnPageStyle}
              >
                <ChevronLeft size={16} /> Sebelumnya
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                style={
                  currentPage === totalPages
                    ? btnPageDisabledStyle
                    : btnPageStyle
                }
              >
                Selanjutnya <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Gaya Kode (Styles) ---
const insightCardStyle = {
  backgroundColor: "var(--surface)",
  padding: "20px",
  borderRadius: "16px",
  boxShadow: "var(--shadow)",
  display: "flex",
  alignItems: "center",
  gap: "15px",
};
const insightLabelStyle = {
  margin: "0 0 5px 0",
  color: "var(--text-muted)",
  fontSize: "14px",
  fontWeight: "600",
};
const insightValueStyle = {
  margin: "0",
  fontSize: "28px",
  fontWeight: "800",
  color: "var(--text)",
};
const filterPanelStyle = {
  backgroundColor: "var(--surface)",
  padding: "15px 20px",
  borderRadius: "12px",
  boxShadow: "var(--shadow)",
  display: "flex",
  gap: "15px",
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: "20px",
};
const selectStyle = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  backgroundColor: "var(--surface-2)",
  fontFamily: "Urbanist, sans-serif",
  fontSize: "14px",
  fontWeight: "600",
  color: "var(--text)",
  outline: "none",
  cursor: "pointer",
};
const tableContainerStyle = {
  backgroundColor: "var(--surface)",
  borderRadius: "16px",
  boxShadow: "var(--shadow)",
  overflow: "hidden",
};
const thStyle = {
  padding: "16px 20px",
  fontWeight: "700",
  borderBottom: "2px solid var(--border)",
};
const tdStyle = {
  padding: "16px 20px",
  borderBottom: "1px solid var(--border)",
};
const rowStyle = {
  backgroundColor: "var(--surface)",
  transition: "background-color 0.2s",
};
const badgeBahayaStyle = {
  backgroundColor: "#fef2f2",
  color: "#ef4444",
  border: "1px solid #fca5a5",
  padding: "6px 12px",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: "700",
  display: "inline-block",
};
const badgeWaspadaStyle = {
  backgroundColor: "#fefce8",
  color: "#ca8a04",
  border: "1px solid #fde047",
  padding: "6px 12px",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: "700",
  display: "inline-block",
};

const paginationContainerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "15px 20px",
  backgroundColor: "var(--surface-2)",
  borderTop: "1px solid var(--border)",
};
const btnPageStyle = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  padding: "8px 16px",
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--text)",
  fontWeight: "700",
  cursor: "pointer",
  fontSize: "13px",
  transition: "all 0.2s",
};
const btnPageDisabledStyle = {
  ...btnPageStyle,
  color: "#94a3b8",
  backgroundColor: "var(--surface-2)",
  cursor: "not-allowed",
  border: "1px solid var(--border)",
};

const btnResetStyle = {
  padding: "8px 14px",
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--text)",
  fontWeight: "700",
  cursor: "pointer",
  fontSize: "13px",
};

const btnExportStyle = {
  padding: "8px 14px",
  backgroundColor: "var(--primary)",
  border: "1px solid var(--primary)",
  borderRadius: "8px",
  color: "var(--primary-contrast)",
  fontWeight: "700",
  cursor: "pointer",
  fontSize: "13px",
};

export default LogPeringatan;
