import React from "react";
import { SourceItem } from "../../types";

interface DataHubViewProps {
  sources: SourceItem[];
}

const SOURCE_DETAILS: Record<string, { logo: string; category: string; description: string }> = {
  "NOAA NCEI": {
    logo: "🌊",
    category: "Oceanographic Satellite Observations",
    description: "National Oceanic and Atmospheric Administration Optimum Interpolation Sea Surface Temperature (OISST v2.1) AVHRR daily global 0.25° grid.",
  },
  CMFRI: {
    logo: "🐟",
    category: "Fisheries Landing Statistics",
    description: "Central Marine Fisheries Research Institute marine fish landing records across western Indian coastal states and national commercial groups.",
  },
  OBIS: {
    logo: "🪸",
    category: "Marine Species Occurrences",
    description: "Ocean Biodiversity Information System global marine biodiversity occurrence repository providing verified coordinate observations.",
  },
  WoRMS: {
    logo: "🏷️",
    category: "Marine Taxonomic Authority",
    description: "World Register of Marine Species authoritative taxonomic registry providing standardized AphiaIDs, accepted names, and marine classification.",
  },
  "BOLD Systems": {
    logo: "🧬",
    category: "Molecular DNA Barcodes",
    description: "Barcode of Life Data System reference database providing COI-5P mitochondrial reference barcodes with ecological metadata.",
  },
  "NCBI GenBank": {
    logo: "🔬",
    category: "Nucleotide Reference Sequences",
    description: "National Center for Biotechnology Information nucleotide database retrieved via E-utilities for marine fish barcode validation.",
  },
};

export const DataHubView: React.FC<DataHubViewProps> = ({ sources }) => {
  return (
    <div className="data-hub-container">
      {/* Intro Header */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <div className="badge-row">
              <span className="badge-pill verified-pill">DATA INTEGRATION LAYER</span>
              <span className="badge-pill">Source Provenance</span>
            </div>
            <h3>Scientific Data Source Registry & Architecture</h3>
            <p className="section-desc">
              This registry describes configured data sources and their intended scope. A listed source is not necessarily ingested or current; live record totals are shown in each data workspace.
            </p>
          </div>
        </div>

        {/* Pipeline Architecture Diagram */}
        <div className="architecture-diagram-strip">
          <div className="arch-step">
            <span className="arch-num">1</span>
            <strong>Source Ingestion</strong>
            <small>NOAA · CMFRI · OBIS · BOLD · NCBI</small>
          </div>
          <div className="arch-arrow">➔</div>
          <div className="arch-step">
            <span className="arch-num">2</span>
            <strong>Standardization</strong>
            <small>WoRMS AphiaID · NetCDF spatial clip</small>
          </div>
          <div className="arch-arrow">➔</div>
          <div className="arch-step">
            <span className="arch-num">3</span>
            <strong>Persistence Layer</strong>
            <small>PostgreSQL / PostGIS / SQLite</small>
          </div>
          <div className="arch-arrow">➔</div>
          <div className="arch-step">
            <span className="arch-num">4</span>
            <strong>ML & Twin Engines</strong>
            <small>Random Forest & Isolation Forest</small>
          </div>
          <div className="arch-arrow">➔</div>
          <div className="arch-step">
            <span className="arch-num">5</span>
            <strong>Interactive UI</strong>
            <small>Digital Twin & Intelligence Dashboards</small>
          </div>
        </div>
      </div>

      {/* Source Cards Grid */}
      <div className="sources-grid">
        {(sources ?? []).map((src) => {
          const detail =
            SOURCE_DETAILS[src.provider] || SOURCE_DETAILS[Object.keys(SOURCE_DETAILS).find((k) => src.name.includes(k)) || ""];

          return (
            <div key={src.name} className="source-card">
              <div className="source-card-header">
                <div className="source-logo-circle">{detail?.logo || "🌐"}</div>
                <div className="source-header-titles">
                  <h4>{src.name}</h4>
                  <span className="source-category">{detail?.category || src.provider}</span>
                </div>
                <span className="source-status-badge">{src.status}</span>
              </div>

              <p className="source-description">{detail?.description || "Scientific data repository integration."}</p>

              <div className="source-meta-list">
                <div className="source-meta-row">
                  <span className="meta-label">Source Format:</span>
                  <span className="meta-val mono">{src.format || "Not specified"}</span>
                </div>
                <div className="source-meta-row">
                  <span className="meta-label">Intended Time Coverage:</span>
                  <span className="meta-val font-bold text-teal">{src.temporal_scope || "Not specified"}</span>
                </div>
                <div className="source-meta-row">
                  <span className="meta-label">Intended Spatial Scope:</span>
                  <span className="meta-val">{src.spatial_scope || "Not specified"}</span>
                </div>
              </div>
            </div>
          );
        })}
        {(!sources || sources.length === 0) && <div className="empty-state-panel" role="status">The source registry is unavailable. Check the API connection.</div>}
      </div>
    </div>
  );
};
