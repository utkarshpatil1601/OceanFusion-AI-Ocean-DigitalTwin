import React, { useState } from "react";
import { FisheriesPrediction, FisheriesSummary } from "../../types";
import { readApiJson } from "../../lib/api";

interface FisheriesViewProps {
  data: FisheriesSummary;
  apiBaseUrl: string;
}

export const FisheriesView: React.FC<FisheriesViewProps> = ({ data, apiBaseUrl }) => {
  const summary = data?.summary ?? {
    landing_record_count: 0,
    statewise_record_count: 0,
    resourcewise_record_count: 0,
    coverage_start: 0,
    coverage_end: 0,
  };
  const states = data?.states ?? [];
  const resources = data?.resources ?? [];

  const [targetYear, setTargetYear] = useState<string>(String(Math.max((summary.coverage_end ?? 0) + 1, new Date().getFullYear())));
  const [selectedState, setSelectedState] = useState<string>("All states");
  const [predictions, setPredictions] = useState<FisheriesPrediction[]>([]);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionMessage, setPredictionMessage] = useState<string | null>(null);
  const [resourceFilter, setResourceFilter] = useState<string>("");

  const maxStateLanding = states.length > 0 ? states.reduce((max, s) => Math.max(max, s.landings_tonnes), 1) : 1;
  const maxResourceLanding = resources.length > 0 ? resources.reduce((max, r) => Math.max(max, r.landings_tonnes), 1) : 1;

  const filteredResources = resources.filter((r) =>
    r.name.toLowerCase().includes(resourceFilter.toLowerCase())
  );

  const runPrediction = async () => {
    setIsPredicting(true);
    setPredictionMessage(null);
    try {
      const params = new URLSearchParams({ year: targetYear });
      if (selectedState !== "All states") {
        params.set("state", selectedState);
      }
      const res = await fetch(`${apiBaseUrl}/fisheries/predict?${params}`);
      const payload = await readApiJson<{
        status?: string;
        items?: FisheriesPrediction[];
        message?: string;
        error?: string;
        limitations?: string[];
      }>(res);

      if (!res.ok || payload.status === "unavailable") {
        throw new Error(payload.error || payload.message || "Model unavailable");
      }

      setPredictions(payload.items ?? []);
      setPredictionMessage(
        payload.limitations?.[0] ?? "Prediction completed using trained Random Forest Regressor."
      );
    } catch (err) {
      setPredictions([]);
      setPredictionMessage(err instanceof Error ? err.message : "Prediction service is unavailable. Check the API connection and retry.");
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="fisheries-container">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">TOTAL CMFRI RECORDS</span>
            <span className="kpi-badge">Official Stats</span>
          </div>
          <div className="kpi-value">{data?.status === "ok" ? summary.landing_record_count.toLocaleString() : "Unavailable"}</div>
          <div className="kpi-subtitle">
            {data?.status === "ok" ? `${summary.statewise_record_count} statewise · ${summary.resourcewise_record_count} national resources` : "No live record totals loaded"}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">HISTORICAL RANGE</span>
            <span className="kpi-badge">Time Series</span>
          </div>
          <div className="kpi-value primary">{data?.status === "ok" ? `${summary.coverage_start}–${summary.coverage_end}` : "Unavailable"}</div>
          <div className="kpi-subtitle">Central Marine Fisheries Research Institute</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">MONITORED COASTAL STATES</span>
            <span className="kpi-badge">Arabian Shelf</span>
          </div>
          <div className="kpi-value">5 States</div>
          <div className="kpi-subtitle">Gujarat · Maharashtra · Goa · Karnataka · Kerala</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">ML MODEL STATUS</span>
            <span className="kpi-badge">Experimental</span>
          </div>
          <div className="kpi-value text-teal">Random Forest</div>
          <div className="kpi-subtitle">Small-data research model; review evaluation in AI Analytics</div>
        </div>
      </div>

      {data?.status !== "ok" && <div className="empty-state-panel" role="status">
        CMFRI landing data is {data?.status === "empty" ? "not loaded" : "unavailable"}. Ingest the CMFRI source files and check the API before viewing trends or running predictions.
      </div>}

      {/* Interactive Random Forest Prediction Workbench */}
      <div className="section-card prediction-card">
        <div className="section-header">
          <div>
            <div className="badge-row">
              <span className="badge-pill ml-pill">MACHINE LEARNING INFERENCE</span>
              <span className="badge-pill r2-pill">Experimental model</span>
            </div>
            <h3>CMFRI Random Forest Landings Predictor</h3>
            <p className="section-desc">
              Forecast marine fish landings (in metric tonnes) for western Indian coastal states using chronological historical lag features and trained ensemble trees.
            </p>
          </div>
        </div>

        <div className="prediction-form-row">
          <div className="form-group">
            <label htmlFor="target-year-select">Target Forecast Year:</label>
            <input
              id="target-year-select"
              type="number"
              min="2014"
              max="2030"
              value={targetYear}
              onChange={(e) => setTargetYear(e.target.value)}
              className="input-select"
            />
          </div>

          <div className="form-group">
            <label htmlFor="target-state-select">Coastal State:</label>
            <select
              id="target-state-select"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="input-select"
            >
              <option value="All states">All 5 Western Coastal States</option>
              {states.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-action">
            <button
              className="btn-primary"
              onClick={runPrediction}
              disabled={isPredicting}
              type="button"
            >
              {isPredicting ? "Computing Inference..." : "⚡ Run Random Forest Prediction"}
            </button>
          </div>
        </div>

        {predictionMessage && (
          <div className="prediction-advisory">
            <span className="info-icon">ℹ️</span>
            <span>{predictionMessage}</span>
          </div>
        )}

        {/* Prediction Results Cards */}
        {predictions.length > 0 && (
          <div className="prediction-results-grid">
            {predictions.map((p) => {
              const prev = p.previous_year_landings_tonnes;
              const pred = p.predicted_landings_tonnes;
              const diff = pred - prev;
              const pct = prev > 0 ? (diff / prev) * 100 : 0;
              const isIncrease = diff >= 0;

              return (
                <div key={p.state} className="prediction-state-card">
                  <div className="state-card-header">
                    <h4>{p.state}</h4>
                    <span className="forecast-year-badge">Year {p.target_year}</span>
                  </div>

                  <div className="prediction-stat-main">
                    <span className="pred-label">PREDICTED LANDING</span>
                    <div className="pred-val">{pred.toLocaleString()} <small>tonnes</small></div>
                  </div>

                  <div className="prediction-stat-sub">
                    <div className="sub-stat">
                      <span>Previous Year ({p.target_year - 1}):</span>
                      <strong>{prev.toLocaleString()} t</strong>
                    </div>
                    <div className="sub-stat">
                      <span>Projected Change:</span>
                      <strong className={isIncrease ? "text-green" : "text-amber"}>
                        {isIncrease ? "+" : ""}{diff.toLocaleString()} t ({pct.toFixed(1)}%)
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* State-wise Historical Comparisons */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h3>State-Wise Cumulative Marine Landings (2013–2025)</h3>
            <p className="section-desc">
              Total landed marine catch volume recorded across western coastline monitoring centers.
            </p>
          </div>
        </div>

        <div className="bar-breakdown-list">
          {states.map((s) => {
            const pct = (s.landings_tonnes / maxStateLanding) * 100;
            return (
              <div key={s.name} className="breakdown-item">
                <div className="breakdown-meta">
                  <strong>{s.name}</strong>
                  <span className="breakdown-number">{s.landings_tonnes.toLocaleString()} tonnes</span>
                </div>
                <div className="breakdown-bar-shell">
                  <div className="breakdown-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* National Resource Breakdown Table */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h3>National Commercial Resource Breakdown</h3>
            <p className="section-desc">
              Species groups and commercial resource volumes reported in CMFRI national monitoring accounts.
            </p>
          </div>
          <div className="table-search">
            <input
              type="text"
              placeholder="Search resource (e.g. Sardine, Mackerel, Prawn)..."
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              aria-label="Filter resources"
            />
          </div>
        </div>

        <div className="ocean-table-wrap">
          <table className="ocean-table">
            <thead>
              <tr>
                <th>Commercial Resource</th>
                <th>Volume (Tonnes)</th>
                <th>Relative Share</th>
                <th>Resource Grouping</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.slice(0, 30).map((r) => {
                const pct = (r.landings_tonnes / maxResourceLanding) * 100;
                return (
                  <tr key={r.name}>
                    <td className="font-bold">{r.name}</td>
                    <td className="mono">{r.landings_tonnes.toLocaleString()} t</td>
                    <td>
                      <div className="table-bar-cell">
                        <div className="table-bar-fill" style={{ width: `${pct}%` }} />
                        <span className="table-bar-pct">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="muted">
                      {r.name.toLowerCase().includes("sardine") || r.name.toLowerCase().includes("mackerel")
                        ? "Small Pelagics"
                        : r.name.toLowerCase().includes("prawn") || r.name.toLowerCase().includes("crab")
                        ? "Crustaceans"
                        : r.name.toLowerCase().includes("tuna") || r.name.toLowerCase().includes("billfish")
                        ? "Large Pelagics"
                        : r.name.toLowerCase().includes("squid") || r.name.toLowerCase().includes("cuttlefish")
                        ? "Cephalopods"
                        : "Demersal Finfish"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
