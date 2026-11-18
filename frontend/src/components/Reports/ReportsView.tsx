import React from "react";
import { QualityReportData } from "../../types";

interface ReportsViewProps {
  data: QualityReportData;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ data }) => {
  const title = data?.title ?? "OceanFusion Data Quality and Coverage Report";
  const coverage = data?.coverage ?? {};
  const quality = data?.quality ?? {};
  const limitations = data?.limitations ?? [];
  const provenance = data?.provenance ?? {
    noaa: "NOAA NCEI OISST",
    obis: "Ocean Biodiversity Information System",
    cmfri: "Central Marine Fisheries Research Institute",
    worms: "World Register of Marine Species",
    ncbi: "NCBI E-utilities",
    bold: "BOLD Systems Portal",
  };

  const downloadReportMD = () => {
    const reportText = `# OceanFusion Research Report & Data Quality Audit
Generated: ${new Date().toISOString()}
Study Region: Arabian Sea and Western Indian Coastline (Gujarat, Maharashtra, Goa, Karnataka, Kerala)

## 1. Executive Summary
OceanFusion is an AI-driven marine data integration and ocean digital twin platform uniting oceanographic (NOAA), fisheries (CMFRI), biodiversity (OBIS/WoRMS), and molecular reference data (BOLD/NCBI).
Data status: ${data?.status ?? "unavailable"}

## 2. Data Source Coverage
${Object.entries(coverage)
  .map(([k, v]) => `- **${k.toUpperCase()}**: ${v.record_count.toLocaleString()} persisted records`)
  .join("\n")}

## 3. Data Quality & Validation Metrics
- Valid Molecular References: ${quality.reference_valid_count?.toLocaleString() ?? "N/A"}
- Invalid/Filtered References: ${quality.reference_invalid_count?.toLocaleString() ?? "0"}
- WoRMS Taxonomy Records: ${quality.taxonomy_record_count?.toLocaleString() ?? "N/A"}
- WoRMS Resolved Taxa: ${quality.taxonomy_resolved_count?.toLocaleString() ?? "N/A"}
- OBIS Dated Occurrences: ${quality.obis_dated_count?.toLocaleString() ?? "N/A"}

## 4. Machine Learning Experimentation Summary
- Current model evaluation metrics are available in AI Analytics when the evaluation API is connected. No model scores are included in this database coverage report.

## 5. Scientific Limitations & Responsible AI Declarations
${limitations.map((l) => `- ${l}`).join("\n")}

## 6. Institutional Provenance
${Object.entries(provenance)
  .map(([k, v]) => `- **${k.toUpperCase()}**: ${v}`)
  .join("\n")}
`;

    const blob = new Blob([reportText], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `oceanfusion_research_report_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="reports-container">
      {/* Report Header Card */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <div className="badge-row">
              <span className="badge-pill verified-pill">DATA QUALITY SUMMARY</span>
              <span className="badge-pill">Database report</span>
            </div>
            <h3>{title}</h3>
            <p className="section-desc">
              Comprehensive scientific summary of database records, validation checks, machine learning limitations, and institutional data lineage.
            </p>
          </div>
          <button className="btn-primary" onClick={downloadReportMD} type="button">
            <span>📥</span> Download Full Report (Markdown)
          </button>
        </div>
      </div>

      {data?.status !== "ok" && <div className="empty-state-panel" role="status">
        Live report data is unavailable. This page will populate after the API connects and source records are ingested.
      </div>}

      {/* Quality Checks Metrics Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">VALID REFERENCE BARCODES</span>
            <span className="kpi-badge verified">Sequence validation</span>
          </div>
          <div className="kpi-value text-teal">{data?.status === "ok" ? quality.reference_valid_count?.toLocaleString() : "Unavailable"}</div>
          <div className="kpi-subtitle">{quality.reference_invalid_count} filtered invalid characters</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">TAXONOMY RESOLVED</span>
            <span className="kpi-badge">WoRMS</span>
          </div>
          <div className="kpi-value primary">{data?.status === "ok" ? `${quality.taxonomy_resolved_count} / ${quality.taxonomy_record_count}` : "Unavailable"}</div>
          <div className="kpi-subtitle">AphiaID standardized marine taxonomic entries</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">TEMPORAL DATED OBIS</span>
            <span className="kpi-badge">Temporal</span>
          </div>
          <div className="kpi-value">{data?.status === "ok" ? `${quality.obis_dated_count} records` : "Unavailable"}</div>
          <div className="kpi-subtitle">Observations with verified occurrence dates</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">AUDIT STATUS</span>
            <span className="kpi-badge">Database report</span>
          </div>
          <div className="kpi-value text-green">{data?.status === "ok" ? "Coverage loaded" : "Unavailable"}</div>
          <div className="kpi-subtitle">Record-level provenance is not independently verified here</div>
        </div>
      </div>

      <div className="bio-split-layout">
        {/* Institutional Lineage */}
        <div className="section-card">
          <div className="section-header">
            <div>
              <h3>Institutional Data Provenance</h3>
              <p className="section-desc">Authoritative sources supplying ground truth records</p>
            </div>
          </div>

          <div className="provenance-list">
            {Object.entries(provenance).map(([k, v]) => (
              <div key={k} className="provenance-item">
                <span className="prov-source-badge">{k.toUpperCase()}</span>
                <span className="prov-source-name">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Known Limitations */}
        <div className="section-card">
          <div className="section-header">
            <div>
              <h3>Scientific Limitations & Research Declarations</h3>
              <p className="section-desc">Critical guardrails for academic and policy interpretation</p>
            </div>
          </div>

          <div className="limitations-box">
            <ul className="limitations-report-list">
              {limitations.map((lim, i) => (
                <li key={i}>
                  <span className="bullet-point">⚠️</span>
                  <span>{lim}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
