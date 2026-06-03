import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  History,
  AlertTriangle,
  Settings,
  Moon,
  Sun,
} from "lucide-react";

function Sidebar({ theme, onToggleTheme }) {
  const location = useLocation();

  const menuItems = [
    { path: "/", nama: "Dashboard Utama", icon: <LayoutDashboard size={20} /> },
    { path: "/riwayat", nama: "Riwayat Data", icon: <History size={20} /> },
    {
      path: "/log-peringatan",
      nama: "Log Peringatan",
      icon: <AlertTriangle size={20} />,
    },
    {
      path: "/perangkat",
      nama: "Manajemen Perangkat",
      icon: <Settings size={20} />,
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark">SV</span>
          <div>
            <h2>Smart Village</h2>
            <p>EWS & Monitoring</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={isActive ? "nav-link active" : "nav-link"}
            >
              {item.icon}
              <span>{item.nama}</span>
            </Link>
          );
        })}
      </nav>

      <button type="button" className="theme-switch" onClick={onToggleTheme}>
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
      </button>
      <div className="sidebar-footer">
        © 2026 Kelompok 10 Mata Kuliah Big Data & IoT
      </div>
    </aside>
  );
}

export default Sidebar;
