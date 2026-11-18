import React from "react";
import { Module } from "../types";

interface SidebarProps {
  activeModule: Module;
  onSelectModule: (module: Module) => void;
}

interface NavItem {
  id: Module;
  label: string;
  badge?: string;
  icon: string;
  description: string;
}

const navItems: NavItem[] = [
  { id: "Overview", label: "Overview", icon: "dashboard", description: "System KPIs & regional synthesis" },
  { id: "Digital Twin", label: "Ocean Digital Twin", badge: "Core", icon: "globe", description: "Spatial SST & ML anomaly twin" },
  { id: "Ocean Explorer", label: "Ocean Explorer", icon: "wave", description: "Daily NOAA OISST observations" },
  { id: "Fisheries", label: "Fisheries Intelligence", badge: "ML", icon: "fish", description: "CMFRI stats & landing predictions" },
  { id: "Biodiversity", label: "Biodiversity", icon: "coral", description: "OBIS occurrences & WoRMS taxonomy" },
  { id: "Molecular", label: "Molecular Analysis", badge: "BLAST-like", icon: "dna", description: "DNA barcode matching (BOLD/NCBI)" },
  { id: "AI Analytics", label: "AI Analytics", badge: "Chatbot & ML", icon: "sparkles", description: "Marine AI Assistant, LSTM, RF & anomalies" },
  { id: "Data Hub", label: "Data Hub", icon: "database", description: "Source registries & data pipelines" },
  { id: "Reports", label: "Research Reports", icon: "report", description: "Quality audits & limitations" },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onSelectModule }) => {
  return (
    <aside className="ocean-sidebar">
      <div className="sidebar-brand">
        <div className="brand-badge">
          <svg className="brand-svg" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="url(#oceanGrad)" stroke="#0df2c9" strokeWidth="1.5" />
            <path d="M10 24C14 18 20 18 24 24C28 30 34 22 36 20" stroke="#0df2c9" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M8 18C12 12 18 12 22 18C26 24 32 16 34 14" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.8" />
            <circle cx="20" cy="14" r="3" fill="#0df2c9" />
            <defs>
              <linearGradient id="oceanGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0a2a3a" />
                <stop offset="1" stopColor="#04121a" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-name">OceanFusion</span>
          <span className="brand-tagline">AI Ocean Digital Twin</span>
        </div>
      </div>

      <div className="sidebar-section-label">SCIENTIFIC WORKSPACES</div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              className={`nav-button ${isActive ? "active" : ""}`}
              onClick={() => onSelectModule(item.id)}
              type="button"
            >
              <span className="nav-icon-wrap">
                {renderIcon(item.icon)}
              </span>
              <div className="nav-text-col">
                <div className="nav-label-row">
                  <span className="nav-label">{item.label}</span>
                  {item.badge && <span className={`nav-badge ${item.badge.toLowerCase()}`}>{item.badge}</span>}
                </div>
                <span className="nav-desc">{item.description}</span>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="study-card">
          <div className="study-card-head">
            <span className="study-card-title">Study Domain</span>
            <span className="study-tag">WEST INDIA</span>
          </div>
          <p className="study-card-text">
            Arabian Sea shelf & EEZ from Kutch (Gujarat) to Cape Comorin (Kerala).
          </p>
          <div className="study-state-chips">
            <span className="chip">GJ</span>
            <span className="chip">MH</span>
            <span className="chip">GA</span>
            <span className="chip">KA</span>
            <span className="chip">KL</span>
          </div>
          <div className="provenance-note">
            <span>Historical Ground-Truth Data</span>
            <small>NOAA · CMFRI · OBIS · WoRMS · BOLD</small>
          </div>
        </div>
      </div>
    </aside>
  );
};

function renderIcon(iconName: string) {
  switch (iconName) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      );
    case "wave":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
          <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
          <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        </svg>
      );
    case "fish":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6s-7.56-2.54-8.5-6Z" />
          <path d="M18 12v.5" />
          <path d="M16 17.93a1 1 0 0 1-.5 1.66 9.87 9.87 0 0 1-5.07-.63l-4.93 3.04L7 17" />
          <path d="M7 7 5.5 5 10.43 8.04" />
        </svg>
      );
    case "coral":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22v-6" />
          <path d="M12 16a5 5 0 0 1 5-5h1a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3h-1a5 5 0 0 0-5 5" />
          <path d="M12 16a5 5 0 0 0-5-5H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1a5 5 0 0 1 5 5" />
          <circle cx="12" cy="7" r="1" />
        </svg>
      );
    case "dna":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 15c6.667-6 13.333 0 20-6" />
          <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
          <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
          <path d="M17 6l-2.5-2.5" />
          <path d="M14 8l-1-1" />
          <path d="M7 18l2.5 2.5" />
          <path d="M10 16l1 1" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          <path d="M5 3v4" />
          <path d="M3 5h4" />
        </svg>
      );
    case "database":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    default:
      return <span>◈</span>;
  }
}
