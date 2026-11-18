import React, { useState, useEffect, useRef } from "react";
import { CorrelationData, MLModelRegistryData, MLEvaluationData } from "../../types";
import { ChatMessage, getMarineResponse, generateId } from "../../lib/marineChat";
import { readApiJson } from "../../lib/api";

interface AIAnalyticsViewProps {
  correlationData: CorrelationData;
  apiBaseUrl: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome-1",
    role: "assistant",
    text: "🌊 **OceanFusion Marine Data Assistant**\n\nAsk about the project’s NOAA observations, fisheries data, anomaly detection, forecasting, biodiversity, or molecular analysis. I’ll distinguish saved evaluation results from live data and note when a model or source is unavailable.\n\nFor current records and model status, open the relevant dashboard or the Models tab.",
    timestamp: Date.now(),
  },
];

export const AIAnalyticsView: React.FC<AIAnalyticsViewProps> = ({ correlationData, apiBaseUrl }) => {
  const [mlData, setMlData] = useState<MLEvaluationData | null>(null);
  const [modelRegistry, setModelRegistry] = useState<MLModelRegistryData | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"models" | "correlation" | "coverage" | "chatbot">("models");

  // Chatbot State
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === "chatbot") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const sendMessage = (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isTyping) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      text: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputText("");
    setIsTyping(true);

    const ctx = {
      sstObservations: correlationData?.coverage?.noaa?.record_count ?? mlData?.isolation_forest?.record_count ?? 0,
      anomalyCount: mlData?.isolation_forest?.anomaly_count ?? 0,
      fisheriesRecords: correlationData?.coverage?.cmfri?.record_count ?? 0,
      speciesOccurrences: correlationData?.coverage?.obis?.record_count ?? 0,
      referenceSequences: (correlationData?.coverage?.bold?.record_count ?? 0) + (correlationData?.coverage?.ncbi?.record_count ?? 0),
      r2Score: mlData?.random_forest?.model_metrics?.r2 ?? 0,
      maeValue: mlData?.random_forest?.model_metrics?.mae_tonnes ?? 0,
      topAnomalyDay: mlData?.anomaly_validation?.top_flagged_days?.[0]?.date ?? "unavailable",
      meanSstFlagged: mlData?.anomaly_validation?.flagged_sst_anomaly?.mean ?? 0,
      temporalCoverage: correlationData?.coverage?.noaa?.date_range?.start && correlationData.coverage.noaa.date_range.end
        ? `${correlationData.coverage.noaa.date_range.start} to ${correlationData.coverage.noaa.date_range.end}`
        : "unavailable",
      lstmStatus: modelRegistry?.models.find((model) => model.id === "noaa_sst_lstm")?.status === "trained"
        ? "experimental; persistence performs better in the saved evaluation"
        : "unavailable",
    };

    setTimeout(() => {
      const reply = getMarineResponse(textToSend, ctx);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          text: reply,
          timestamp: Date.now(),
        },
      ]);
      setIsTyping(false);
    }, 450);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderMarkdown = (text: string): string => {
    const escapedText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
    return escapedText
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\n\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g, (_, header, rows) => {
        const ths = header.split("|").filter(Boolean).map((h: string) => `<th>${h.trim()}</th>`).join("");
        const trs = rows.trim().split("\n").map((row: string) => {
          const tds = row.split("|").filter(Boolean).map((d: string) => `<td>${d.trim()}</td>`).join("");
          return `<tr>${tds}</tr>`;
        }).join("");
        return `<table class="chat-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
      })
      .replace(/^• (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
      .replace(/\n/g, "<br/>");
  };

  useEffect(() => {
    let cancelled = false;
    const loadAnalytics = async () => {
      const results = await Promise.allSettled([
        fetch(`${apiBaseUrl}/ml/metrics`).then((response) => {
          if (!response.ok) throw new Error(`ML metrics request failed (HTTP ${response.status}).`);
          return readApiJson<MLEvaluationData>(response);
        }),
        fetch(`${apiBaseUrl}/ml/models`).then((response) => {
          if (!response.ok) throw new Error(`Model registry request failed (HTTP ${response.status}).`);
          return readApiJson<MLModelRegistryData>(response);
        }),
      ]);
      if (cancelled) return;
      const [metricsResult, registryResult] = results;
      if (metricsResult.status === "fulfilled") setMlData(metricsResult.value);
      if (registryResult.status === "fulfilled") setModelRegistry(registryResult.value);
      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason instanceof Error ? result.reason.message : "An AI Analytics API request failed.");
      setAnalyticsError(failures.length ? failures.join(" ") : null);
    };
    void loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const coverage = correlationData?.coverage ?? {};
  const reasons = correlationData?.reasons ?? [
    "NOAA and CMFRI share fewer than three annual periods; correlation is withheld.",
    "OBIS records have no normalized dates for temporal alignment.",
    "Unresolved BOLD records are excluded from marine evidence.",
  ];
  const correlations = correlationData?.correlations ?? [];
  const coverageSources = [
    { key: "noaa", label: "NOAA OISST" },
    { key: "cmfri", label: "CMFRI Fisheries" },
    { key: "obis", label: "OBIS Occurrences" },
    { key: "bold", label: "BOLD Barcodes" },
    { key: "ncbi", label: "NCBI References" },
  ].map((source) => ({ ...source, data: coverage[source.key] }))
    .filter((source) => source.data);

  const rf = mlData?.random_forest;
  const iso = mlData?.isolation_forest;
  const val = mlData?.anomaly_validation;
  const lstm = modelRegistry?.models.find((model) => model.id === "noaa_sst_lstm");

  return (
    <div className="ai-analytics-container">
      {/* Tab Navigation */}
      <div className="analytics-tabs-row">
        <button
          className={`analytics-tab-btn ${activeTab === "models" ? "active" : ""}`}
          onClick={() => setActiveTab("models")}
          type="button"
        >
          <span>🤖</span> Machine Learning Models (RF & Isolation Forest)
        </button>
        <button
          className={`analytics-tab-btn ${activeTab === "correlation" ? "active" : ""}`}
          onClick={() => setActiveTab("correlation")}
          type="button"
        >
          <span>📈</span> Cross-Domain Correlation Analysis
        </button>
        <button
          className={`analytics-tab-btn ${activeTab === "coverage" ? "active" : ""}`}
          onClick={() => setActiveTab("coverage")}
          type="button"
        >
          <span>📊</span> Multi-Source Data Coverage Alignment
        </button>
        <button
          className={`analytics-tab-btn ${activeTab === "chatbot" ? "active" : ""}`}
          onClick={() => setActiveTab("chatbot")}
          type="button"
        >
          <span>🌊</span> Marine AI Assistant (Chatbot)
        </button>
      </div>
      {analyticsError && <div className="analytics-load-error" role="alert">AI Analytics could not load all model details: {analyticsError}</div>}

      {activeTab === "models" && (
        <div className="ml-models-dashboard">
          <div className="section-card model-spec-card">
            <div className="section-header">
              <div>
                <div className="badge-row">
                  <span className="badge-pill ml-pill">FORECAST READINESS</span>
                  <span className="badge-pill alert-pill">{lstm?.status === "trained" ? "Experimental" : "Unavailable"}</span>
                </div>
                <h3>Model 3: NOAA SST LSTM Forecasting</h3>
                <p className="section-desc">
                  {lstm?.limitation ?? "Forecasting remains withheld until sufficient validated NOAA history is available."}
                </p>
              </div>
            </div>
            <div className="model-meta-grid">
              <div className="model-meta-item">
                <label>Current NOAA History</label>
                <strong>{lstm?.coverage ? `${lstm.coverage.distinct_days} daily observations` : "Coverage unavailable"}</strong>
              </div>
              <div className="model-meta-item">
                <label>Required Before Training</label>
                <strong>{lstm?.minimum_required_days ?? mlData?.forecast?.minimum_required_days ?? 365} validated days</strong>
              </div>
              <div className="model-meta-item">
                <label>Forecast Horizons</label>
                <strong>1, 3 and 7 days</strong>
              </div>
            </div>
            {mlData?.forecast?.metrics_by_horizon && (
              <div className="metrics-comparison-strip">
                {[1, 3, 7].map((horizon) => {
                  const metric = mlData.forecast?.metrics_by_horizon?.[String(horizon)]?.lstm;
                  return metric ? (
                    <div className="metric-box" key={horizon}>
                      <span className="metric-tag">{horizon}-DAY TEST MAE</span>
                      <div className="metric-big">{metric.mae.toFixed(3)}°C</div>
                      <small>RMSE {metric.rmse.toFixed(3)}°C · R² {metric.r2.toFixed(3)}</small>
                    </div>
                  ) : null;
                })}
              </div>
            )}
            <div className="limitations-alert">
              <strong>Evaluation note:</strong> This artifact is experimental. Saved chronological evaluation shows the persistence baseline has lower error at all three forecast horizons; use the baseline for comparison, not the LSTM as a validated operational model.
            </div>
          </div>

          {/* Model 1: Random Forest Regressor */}
          <div className="section-card model-spec-card">
            <div className="section-header">
              <div>
                <div className="badge-row">
                  <span className="badge-pill ml-pill">SUPERVISED REGRESSION</span>
                  <span className="badge-pill r2-pill">Aggregate test R²: {rf?.model_metrics?.r2.toFixed(3) ?? "Unavailable"}</span>
                </div>
                <h3>Model 1: CMFRI Random Forest Landings Regressor</h3>
                <p className="section-desc">
                  Predicts annual marine fish landings across five western Indian states using historical lag features and ensemble decision trees.
                </p>
              </div>
            </div>

            <div className="model-meta-grid">
              <div className="model-meta-item">
                <label>Target Variable</label>
                <strong>Annual Marine Landings (Metric Tonnes)</strong>
              </div>
              <div className="model-meta-item">
                <label>Input Features</label>
                <div className="feature-tags">
                  <span className="tag">year</span>
                  <span className="tag">state (categorical)</span>
                  <span className="tag">previous_year_landings_tonnes</span>
                </div>
              </div>
              <div className="model-meta-item">
                <label>Chronological Train Split</label>
                <strong>2014–2022 (45 records)</strong>
              </div>
              <div className="model-meta-item">
                <label>Chronological Test Split</label>
                <strong>2023–2025 (15 records)</strong>
              </div>
            </div>

            <div className="metrics-comparison-strip">
              <div className="metric-box highlighted">
                <span className="metric-tag">COEFFICIENT OF DETERMINATION (R²)</span>
                <div className="metric-big text-teal">{rf?.model_metrics?.r2.toFixed(4) ?? "Unavailable"}</div>
                <small>Aggregate out-of-time result; saved state-level scores are negative, so performance is not reliable for every state</small>
              </div>

              <div className="metric-box">
                <span className="metric-tag">MEAN ABSOLUTE ERROR (MAE)</span>
                <div className="metric-big">{rf?.model_metrics?.mae_tonnes != null ? `${rf.model_metrics.mae_tonnes.toLocaleString()} t` : "Unavailable"}</div>
                <small className="text-green">
                  {rf?.persistence_baseline?.mae_tonnes != null ? `Persistence baseline: ${rf.persistence_baseline.mae_tonnes.toLocaleString()} t` : "Persistence baseline unavailable"}
                </small>
              </div>

              <div className="metric-box">
                <span className="metric-tag">ROOT MEAN SQUARED ERROR (RMSE)</span>
                <div className="metric-big">{rf?.model_metrics?.rmse_tonnes != null ? `${rf.model_metrics.rmse_tonnes.toLocaleString()} t` : "Unavailable"}</div>
                <small className="text-green">
                  {rf?.persistence_baseline?.rmse_tonnes != null ? `Persistence baseline: ${rf.persistence_baseline.rmse_tonnes.toLocaleString()} t` : "Persistence baseline unavailable"}
                </small>
              </div>
            </div>

            <div className="limitations-alert">
              <strong>Model Limitations & Context:</strong>
              <ul>
                <li>Statewise landing records represent a small, focused historical series (65 records).</li>
                <li>Aggregate scores can conceal weak state-level performance; saved state-level test R² values are negative. Treat these estimates as experimental, not operational forecasts.</li>
                <li>National resource-wise records are excluded due to incomplete historical timelines in available workbooks.</li>
              </ul>
            </div>
          </div>

          {/* Model 2: Isolation Forest */}
          <div className="section-card model-spec-card">
            <div className="section-header">
              <div>
                <div className="badge-row">
                  <span className="badge-pill ml-pill">UNSUPERVISED ANOMALY DETECTION</span>
                  <span className="badge-pill alert-pill">Contamination Rate: 1.0%</span>
                </div>
                <h3>Model 2: NOAA SST Isolation Forest Anomaly Detector</h3>
                <p className="section-desc">
                  Detects multivariate thermal and spatial outliers in satellite Sea Surface Temperature observations over the Arabian Sea.
                </p>
              </div>
            </div>

            <div className="model-meta-grid">
              <div className="model-meta-item">
                <label>Analyzed Observations</label>
                <strong>{iso?.record_count != null ? `${iso.record_count.toLocaleString()} NetCDF grid points` : "Unavailable"}</strong>
              </div>
              <div className="model-meta-item">
                <label>Input Feature Vector</label>
                <div className="feature-tags">
                  <span className="tag">sst</span>
                  <span className="tag">sst_anomaly</span>
                  <span className="tag">latitude</span>
                  <span className="tag">longitude</span>
                  <span className="tag">day_of_year</span>
                </div>
              </div>
              <div className="model-meta-item">
                <label>Configured Contamination</label>
                <strong>{iso?.anomaly_count != null ? `1.0% (${iso.anomaly_count.toLocaleString()} flagged points)` : "Unavailable"}</strong>
              </div>
              <div className="model-meta-item">
                <label>Anomaly Score Bounds</label>
                <strong>{iso?.score_range?.min != null && iso.score_range.max != null ? `${iso.score_range.min.toFixed(4)} to ${iso.score_range.max.toFixed(4)}` : "Unavailable"}</strong>
              </div>
            </div>

            {/* Validation Breakdown */}
            <div className="metrics-comparison-strip">
              <div className="metric-box">
                <span className="metric-tag">MEAN SST ANOMALY OF FLAGGED CELLS</span>
                <div className="metric-big text-amber">
                  {val?.flagged_sst_anomaly?.mean != null ? `${val.flagged_sst_anomaly.mean.toFixed(2)}°C` : "Unavailable"}
                </div>
                <small>Flagged cells should be reviewed against observed SST anomalies</small>
              </div>

              <div className="metric-box">
                <span className="metric-tag">MAXIMUM OBSERVED COLD DEVIATION</span>
                <div className="metric-big text-blue">
                  {val?.flagged_sst_anomaly?.min != null ? `${val.flagged_sst_anomaly.min.toFixed(2)}°C` : "Unavailable"}
                </div>
                <small>Detected deep cold upwelling anomaly cells</small>
              </div>

              <div className="metric-box">
                <span className="metric-tag">PEAK ANOMALY OBSERVATION DAY</span>
                <div className="metric-big">
                  {val?.top_flagged_days?.[0]?.date ?? "Unavailable"}
                </div>
                <small>{val?.top_flagged_days?.[0]?.count != null ? `${val.top_flagged_days[0].count} anomalous grid cells flagged` : "No live anomaly validation result"}</small>
              </div>
            </div>

            {/* Top Flagged Days Table */}
            <div className="top-days-container">
              <h4>
                Top Anomaly Concentration Days ({iso?.date_range?.start?.slice(0, 7) ?? "acquired sample"})
              </h4>
              <div className="top-days-chips">
                {(val?.top_flagged_days ?? []).map((d) => (
                  <div key={d.date} className="day-chip">
                    <span className="day-name">{d.date}</span>
                    <strong className="day-count">{d.count} anomalies</strong>
                  </div>
                ))}
                {!val?.top_flagged_days?.length && <p className="muted">Live anomaly validation data is unavailable.</p>}
              </div>
            </div>

            <div className="limitations-alert">
              <strong>Scientific Validation Protocol:</strong>
              <ul>
                <li>Isolation Forest identifies points requiring fewer tree partitions (isolated points).</li>
                <li>An anomaly flag is a mathematical signal indicating extreme spatial/thermal departure, not conclusive proof of a physical event.</li>
                <li>The acquired 2024–2025 window is not a multi-decadal climatology and cannot prove physical ocean events.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === "correlation" && (
        <div className="section-card">
          <div className="section-header">
            <div>
              <h3>Multi-Domain Correlation Synthesis</h3>
              <p className="section-desc">
                This currently compares annual NOAA sea surface temperature with annual CMFRI fish landings. Other sources are shown in Coverage, but do not yet have enough date-aligned measurements for correlation.
              </p>
            </div>
          </div>

          <div className="correlation-explanation-box">
            <span className="info-icon">📐</span>
            <div className="explanation-text">
              <strong>Why only one comparison is available:</strong>
              <p>
                This page currently supports one annual comparison: NOAA mean SST versus CMFRI total landings. It requires at least three shared years. OBIS sightings and DNA reference records are not included because they do not provide a matching, sufficiently complete time series.
              </p>
              <ul>
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {correlations.length > 0 ? <div className="ocean-table-wrap">
            <table className="ocean-table">
              <thead>
                <tr>
                  <th>Variable A</th>
                  <th>Variable B</th>
                  <th>Correlation Coefficient</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {correlations.map((c) => (
                    <tr key={`${c.left}-${c.right}`}>
                      <td className="mono">{c.left}</td>
                      <td className="mono">{c.right}</td>
                      <td className="mono font-bold">{c.coefficient}</td>
                      <td>{c.method}</td>
                      <td><span className="status-pill success">Computed</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div> : <div className="correlation-empty-state" role="status">
            <div className="correlation-empty-icon">↔</div>
            <div>
              <strong>No correlation calculated yet</strong>
              <p>Currently supported: annual mean NOAA SST ↔ annual CMFRI landings.</p>
              {correlationData?.mode === "database" ? <p>
                Shared years found: {correlationData.aligned_periods?.length ?? 0} of the 3 required
                {correlationData.aligned_periods?.length ? ` (${correlationData.aligned_periods.join(", ")})` : ""}.
              </p> : <p>API coverage data is unavailable, so shared years could not be checked.</p>}
              <p>When the sources contain at least three matching years, this panel will show the coefficient, method, and years used. See Multi-Source Data Coverage for each source’s available date range.</p>
            </div>
          </div>}
        </div>
      )}

      {activeTab === "coverage" && (
        <div className="section-card coverage-alignment-panel">
          <div className="section-header">
            <div>
              <h3>Multi-Source Data Coverage Alignment</h3>
              <p className="section-desc">
                Compare the records, time periods, and geographic scope currently stored for each source.
              </p>
            </div>
          </div>

          {coverageSources.length ? (
            <div className="coverage-source-grid">
              {coverageSources.map(({ key, label, data: source }) => {
                const period = source.date_range
                  ? source.date_range.start && source.date_range.end
                    ? `${source.date_range.start.slice(0, 10)} – ${source.date_range.end.slice(0, 10)}`
                    : "No dated coverage"
                  : source.year_range
                    ? source.year_range.start && source.year_range.end
                      ? `${source.year_range.start} – ${source.year_range.end}`
                      : "No year coverage"
                    : "Reference collection; dates not provided";
                return (
                  <article className="coverage-source-card" key={key}>
                    <div className="coverage-source-heading">
                      <strong>{label}</strong>
                      <span>{(source.record_count ?? 0).toLocaleString()} records</span>
                    </div>
                    <dl>
                      <div>
                        <dt>Time coverage</dt>
                        <dd>{period}</dd>
                      </div>
                      <div>
                        <dt>Geographic scope</dt>
                        <dd>{source.spatial_scope || "Not specified"}</dd>
                      </div>
                      {key === "obis" && (
                        <div>
                          <dt>Dated records</dt>
                          <dd>{(source.dated_record_count ?? 0).toLocaleString()}</dd>
                        </div>
                      )}
                      {key === "bold" && (
                        <div>
                          <dt>Marine / unresolved</dt>
                          <dd>{(source.marine_record_count ?? 0).toLocaleString()} / {(source.unresolved_record_count ?? 0).toLocaleString()}</dd>
                        </div>
                      )}
                    </dl>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-panel" role="status">
              Source coverage is unavailable. Check the API connection and retry.
            </div>
          )}

          <div className="limitations-alert coverage-alignment-note">
            <strong>How to read this comparison:</strong>
            <p>
              Record totals are not directly comparable because sources use different record types and sampling methods. Temporal overlap is limited; cross-domain correlations are withheld when there are too few aligned periods.
            </p>
            {reasons.length > 0 && <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
          </div>
        </div>
      )}

      {activeTab === "chatbot" && (
        <div className="chatbot-container">
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar">🌊</div>
              <div>
                <strong>OceanFusion Marine AI Assistant</strong>
                <span className="chatbot-status-dot">● Online · Data Aware</span>
              </div>
            </div>
            <div className="chatbot-header-meta">
              <span className="chatbot-badge">NOAA OISST {iso?.record_count?.toLocaleString() ?? "data unavailable"}</span>
              <span className="chatbot-badge">LSTM experimental · baseline performs better</span>
              <span className="chatbot-badge">RF test R²: {rf?.model_metrics?.r2.toFixed(3) ?? "unavailable"}</span>
            </div>
          </div>

          <div className="chat-messages-pane">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble-row ${msg.role}`}>
                {msg.role === "assistant" && (
                  <div className="chat-avatar-icon">🌊</div>
                )}
                <div className={`chat-bubble ${msg.role}`}>
                  <div
                    className="chat-bubble-text"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                  />
                  <span className="chat-timestamp">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {msg.role === "user" && (
                  <div className="chat-avatar-icon user-avatar">👤</div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="chat-bubble-row assistant">
                <div className="chat-avatar-icon">🌊</div>
                <div className="chat-bubble assistant typing-bubble">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="chat-suggestions">
            <span className="suggestion-label">Suggested:</span>
            {[
              "What anomalies did Isolation Forest detect?",
              "How does the LSTM forecast work?",
              "Explain the Random Forest fisheries model",
              "Tell me about Arabian Sea oceanography",
              "How does BOLD DNA barcoding work?",
              "What data sources are integrated?",
            ].map((promptText) => (
              <button
                key={promptText}
                className="suggestion-chip"
                onClick={() => sendMessage(promptText)}
                type="button"
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="chat-input-bar">
            <input
              className="chat-input"
              type="text"
              placeholder="Ask about NOAA SST, ML anomalies, LSTM forecasts, fisheries predictions, or DNA barcoding..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button
              className="chat-send-btn"
              onClick={() => sendMessage()}
              disabled={isTyping || !inputText.trim()}
              type="button"
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
