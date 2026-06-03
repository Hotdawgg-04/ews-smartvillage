import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import Sidebar from "./components/Sidebar";

// Import semua halaman yang ada di folder pages
import Dashboard from "./pages/Dashboard";
import RiwayatData from "./pages/RiwayatData";
import LogPeringatan from "./pages/LogPeringatan";
import ManajemenPerangkat from "./pages/ManajemenPerangkat";

function App() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored;
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    return prefersDark ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="app-shell">
      {/* Sidebar akan selalu tampil di sisi kiri */}
      <Sidebar theme={theme} onToggleTheme={toggleTheme} />

      {/* Konten utama yang berubah-ubah sesuai menu yang diklik */}
      <div className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/riwayat" element={<RiwayatData />} />
          <Route path="/log-peringatan" element={<LogPeringatan />} />
          <Route path="/perangkat" element={<ManajemenPerangkat />} />
        </Routes>
      </div>

      <button
        type="button"
        className="theme-fab"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        <span>{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
    </div>
  );
}

export default App;
