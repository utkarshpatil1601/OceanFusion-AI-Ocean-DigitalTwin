import React from "react";
import { Module, OverviewData } from "../../types";

interface OverviewViewProps {
  data: OverviewData;
  onSelectModule: (module: Module) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ data, onSelectModule }) => {
  const isLiveData = data?.mode === "database";
  const kpis = data?.kpis ?? {
    datasets: 0,
    ocean_observations: 0,
    fisheries_landings: 0,
    species_occurrences: 0,
    reference_sequences: 0,
  };

  return (
    <div className="overview-container">
      {/* Hero Welcome Banner */}
      <div className="hero-banner">
        <div className="hero-content">
          <div className="badge-row">
            <span className="badge-pill verified-pill">AI-POWERED MARINE DIGITAL TWIN</span>
            <span className="badge-pill">Western Indian Coastline & Arabian Sea</span>
          </div>
          <h2 className="hero-heading">
            Unifying Oceanography, Fisheries, <br />
            <span className="highlight-text">& Molecular Biodiversity Data</span>
          </h2>
          <p className="hero-subtext">
            OceanFusion bridges fragmented scientific repositories—connecting satellite Sea Surface Temperature (NOAA),
            coastal fisheries landings (CMFRI), species occurrences (OBIS), marine taxonomy (WoRMS), and molecular DNA barcodes (BOLD/NCBI)
            with machine learning anomaly detection and a historical Ocean Digital Twin.
          </p>
          <div className="hero-actions">
            <button
              className="btn-primary hero-btn"
              onClick={() => onSelectModule("Digital Twin")}
              type="button"
            >
              <span>◎</span> Launch Ocean Digital Twin
            </button>
            <button
              className="btn-secondary hero-btn"
              onClick={() => onSelectModule("Fisheries")}
              type="button"
            >
              <span>◈</span> Fisheries Landing Predictor
            </button>
            <button
              className="btn-secondary hero-btn"
              onClick={() => onSelectModule("Molecular")}
              type="button"
            >
              <span>⌬</span> DNA Barcode Workbench
            </button>
          </div>
        </div>

        <div className="hero-stats-panel">
          <div className="region-badge-card">
            <span className="region-title">GEOGRAPHIC STUDY DOMAIN</span>
            <div className="region-name">Arabian Sea & Western Indian Shelf</div>
            <div className="region-coords mono">5.0°N–26.0°N · 50.0°E–78.0°E</div>
            <div className="states-list">
              <span className="state-badge">Gujarat</span>
              <span className="state-badge">Maharashtra</span>
              <span className="state-badge">Goa</span>
              <span className="state-badge">Karnataka</span>
              <span className="state-badge">Kerala</span>
            </div>
            <div className="hero-status-strip">
              <span className={`pulse-dot ${isLiveData ? "green" : ""}`} />
              <span>{isLiveData ? "Connected · live database summary loaded" : "Waiting for API · live totals unavailable"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card" onClick={() => onSelectModule("Ocean Explorer")}>
          <div className="kpi-meta">
            <span className="kpi-title">OCEAN OBSERVATIONS</span>
            <span className="kpi-badge">NOAA OISST</span>
          </div>
          <div className="kpi-value primary">{isLiveData ? kpis.ocean_observations.toLocaleString() : "Unavailable"}</div>
          <div className="kpi-subtitle">Persisted NOAA OISST observations</div>
        </div>

        <div className="kpi-card" onClick={() => onSelectModule("Fisheries")}>
          <div className="kpi-meta">
            <span className="kpi-title">FISHERIES LANDINGS</span>
            <span className="kpi-badge">CMFRI</span>
          </div>
          <div className="kpi-value">{isLiveData ? (kpis.fisheries_landings ?? 0).toLocaleString() : "Unavailable"}</div>
          <div className="kpi-subtitle">CMFRI landing records available in the database</div>
        </div>

        <div className="kpi-card" onClick={() => onSelectModule("Biodiversity")}>
          <div className="kpi-meta">
            <span className="kpi-title">SPECIES OCCURRENCES</span>
            <span className="kpi-badge">OBIS / WoRMS</span>
          </div>
          <div className="kpi-value">{isLiveData ? (kpis.species_occurrences ?? 0).toLocaleString() : "Unavailable"}</div>
          <div className="kpi-subtitle">Persisted OBIS occurrence records</div>
        </div>

        <div className="kpi-card" onClick={() => onSelectModule("Molecular")}>
          <div className="kpi-meta">
            <span className="kpi-title">MOLECULAR REFERENCES</span>
            <span className="kpi-badge">BOLD + NCBI</span>
          </div>
          <div className="kpi-value text-teal">{isLiveData ? (kpis.reference_sequences ?? 0).toLocaleString() : "Unavailable"}</div>
          <div className="kpi-subtitle">Stored BOLD and NCBI reference sequences</div>
        </div>
      </div>

      {/* Module Launchpad Cards */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h3>Integrated Scientific Workspaces</h3>
            <p className="section-desc">Select a module to begin specialized exploratory research.</p>
          </div>
        </div>

        <div className="workspace-cards-grid">
          <div className="workspace-card" onClick={() => onSelectModule("Digital Twin")}>
            <div className="ws-icon-circle">◎</div>
            <div className="ws-card-body">
              <h4>Historical Ocean Digital Twin</h4>
              <p>
                Interactive map-based representation of acquired 2024–2025 Arabian Sea conditions with SST heatmaps,
                Isolation Forest anomaly markers, timeline playback, and hypothetical sensitivity simulations.
              </p>
            </div>
            <span className="ws-link">Open Twin ➔</span>
          </div>

          <div className="workspace-card" onClick={() => onSelectModule("Fisheries")}>
            <div className="ws-icon-circle">◈</div>
            <div className="ws-card-body">
              <h4>Fisheries Landing Predictor</h4>
              <p>
                Analyze official CMFRI landing trends across Gujarat, Maharashtra, Goa, Karnataka, and Kerala.
                Run Random Forest regression predictions on out-of-time catch yields.
              </p>
            </div>
            <span className="ws-link">Explore Fisheries ➔</span>
          </div>

          <div className="workspace-card" onClick={() => onSelectModule("Molecular")}>
            <div className="ws-icon-circle">⌬</div>
            <div className="ws-card-body">
              <h4>Molecular DNA Barcoding</h4>
              <p>
                Upload or test sample marine FASTA sequences. Perform pairwise local alignment against curated
                COI-5P reference barcodes with GC content and quality thresholds.
              </p>
            </div>
            <span className="ws-link">Launch Workbench ➔</span>
          </div>

          <div className="workspace-card" onClick={() => onSelectModule("AI Analytics")}>
            <div className="ws-icon-circle">✦</div>
            <div className="ws-card-body">
              <h4>Machine Learning Analytics</h4>
              <p>
                Review the available Random Forest and Isolation Forest evaluations, cross-domain alignment,
                forecast comparisons, and scientific limitations.
              </p>
            </div>
            <span className="ws-link">View ML Metrics ➔</span>
          </div>
        </div>
      </div>

      {/* Six Scientific Foundations */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h3>Institutional Data Foundations</h3>
            <p className="section-desc">Six scientific repositories integrated into OceanFusion</p>
          </div>
        </div>

        <div className="foundations-grid">
          <div className="foundation-box">
            <span className="f-icon">🌊</span>
            <strong>NOAA NCEI</strong>
            <small>Satellite Sea Surface Temperature (OISST v2.1 AVHRR)</small>
          </div>
          <div className="foundation-box">
            <span className="f-icon">🐟</span>
            <strong>CMFRI</strong>
            <small>Central Marine Fisheries Research Institute landing stats</small>
          </div>
          <div className="foundation-box">
            <span className="f-icon">🪸</span>
            <strong>OBIS</strong>
            <small>Ocean Biodiversity Information System species records</small>
          </div>
          <div className="foundation-box">
            <span className="f-icon">🏷️</span>
            <strong>WoRMS</strong>
            <small>World Register of Marine Species taxonomic standardization</small>
          </div>
          <div className="foundation-box">
            <span className="f-icon">🧬</span>
            <strong>BOLD Systems</strong>
            <small>Barcode of Life Data System COI-5P mitochondrial markers</small>
          </div>
          <div className="foundation-box">
            <span className="f-icon">🔬</span>
            <strong>NCBI GenBank</strong>
            <small>Curated marine organism nucleotide reference sequences</small>
          </div>
        </div>
      </div>
    </div>
  );
};
