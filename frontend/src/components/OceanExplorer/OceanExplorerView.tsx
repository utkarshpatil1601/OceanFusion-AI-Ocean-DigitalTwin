import React, { useEffect, useMemo, useState } from "react";
import { OceanSummaryData, SSTForecast } from "../../types";
import { readApiJson } from "../../lib/api";

interface OceanExplorerViewProps {
  data: OceanSummaryData;
  apiBaseUrl: string;
}

export const OceanExplorerView: React.FC<OceanExplorerViewProps> = ({ data, apiBaseUrl }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [forecastHorizon, setForecastHorizon] = useState<number>(7);
  const [forecastLatitude, setForecastLatitude] = useState("15");
  const [forecastLongitude, setForecastLongitude] = useState("72");
  const [forecastDate, setForecastDate] = useState("");
  const [forecast, setForecast] = useState<SSTForecast | null>(null);
  const [forecastMessage, setForecastMessage] = useState<string | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const summary = data?.summary ?? {
    mean_sst: 0,
    min_sst: 0,
    max_sst: 0,
    observation_count: 0,
  };
  const coverage = data?.coverage ?? { start: "", end: "" };
  const coverageStart = coverage.start.slice(0, 10);
  const coverageEnd = coverage.end.slice(0, 10);
  const earliestForecastDate = (() => {
    if (!coverageStart) return "";
    const firstDate = new Date(`${coverageStart}T00:00:00Z`);
    firstDate.setUTCDate(firstDate.getUTCDate() + 29);
    return firstDate.toISOString().slice(0, 10);
  })();
  useEffect(() => {
    if (!earliestForecastDate || !coverageEnd) return;
    setForecastDate((current) =>
      !current || current < earliestForecastDate || current > coverageEnd
        ? coverageEnd
        : current,
    );
  }, [earliestForecastDate, coverageEnd]);
  const daily = data?.daily ?? [];
  const monthly = useMemo(() => {
    if (data?.monthly?.length) return data.monthly;
    const groups = new Map<string, { sst: number; anomaly: number; anomalyCount: number; count: number }>();
    daily.forEach((row) => {
      const month = row.date.slice(0, 7);
      const group = groups.get(month) ?? { sst: 0, anomaly: 0, anomalyCount: 0, count: 0 };
      group.sst += row.mean_sst * row.count;
      group.count += row.count;
      if (row.mean_anomaly !== null) {
        group.anomaly += row.mean_anomaly * row.count;
        group.anomalyCount += row.count;
      }
      groups.set(month, group);
    });
    return [...groups.entries()].map(([month, group]) => ({
      month,
      mean_sst: group.sst / group.count,
      mean_anomaly: group.anomalyCount ? group.anomaly / group.anomalyCount : null,
      count: group.count,
    }));
  }, [data?.monthly, daily]);

  const filteredDays = daily.filter((d) => d.date.includes(searchTerm));

  // Compute chart bounds safely
  const meanTemps = daily.map((d) => d.mean_sst);
  let minTemp = 24.0;
  let maxTemp = 30.0;
  if (meanTemps.length > 0) {
    minTemp = meanTemps.reduce((a, b) => (b < a ? b : a), meanTemps[0]);
    maxTemp = meanTemps.reduce((a, b) => (b > a ? b : a), meanTemps[0]);
  }
  const tempRange = maxTemp - minTemp || 1;
  const monthlyTemps = monthly.map((month) => month.mean_sst);
  const monthlyMin = monthlyTemps.length ? Math.min(...monthlyTemps) : 24;
  const monthlyMax = monthlyTemps.length ? Math.max(...monthlyTemps) : 30;
  const monthlyRange = monthlyMax - monthlyMin || 1;
  const selectedMonthData = monthly.find((month) => month.month === selectedMonth) ?? null;
  const selectedDayData = daily.find((day) => day.date === selectedDay) ?? null;
  const hasObservations = data?.status === "ok" && daily.length > 0;
  const selectedMonthDayCount = selectedMonth
    ? daily.filter((day) => day.date.startsWith(selectedMonth)).length
    : 0;

  const runForecast = async () => {
    setForecastLoading(true);
    setForecastMessage(null);
    try {
      const params = new URLSearchParams({
        latitude: forecastLatitude,
        longitude: forecastLongitude,
        horizon: String(forecastHorizon),
      });
      if (forecastDate) params.set("date", forecastDate);
      const response = await fetch(`${apiBaseUrl}/ocean/forecast?${params}`);
      const payload = await readApiJson<SSTForecast & { error?: string; message?: string }>(response);
      if (!response.ok || payload.status !== "ok") {
        throw new Error(payload.error || payload.message || "Forecast is unavailable.");
      }
      setForecast(payload);
    } catch (error) {
      setForecast(null);
      setForecastMessage(error instanceof Error ? error.message : "Forecast service is unavailable. Check that the API is running and try again.");
    } finally {
      setForecastLoading(false);
    }
  };

  const downloadCSV = () => {
    const headers = ["date", "mean_sst_celsius", "mean_anomaly_celsius", "observation_count"];
    const rows = daily.map((d) => [d.date, d.mean_sst, d.mean_anomaly ?? "", d.count]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `noaa_oisst_daily_summary_${coverage.start.slice(0, 10)}_${coverage.end.slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ocean-explorer-container">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">TOTAL OBSERVATIONS</span>
            <span className="kpi-badge">NOAA OISST v2.1</span>
          </div>
          <div className="kpi-value">{hasObservations ? summary.observation_count.toLocaleString() : "Unavailable"}</div>
          <div className="kpi-subtitle">Arabian Sea study polygon · {monthly.length} monthly periods</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">MONTHLY MEAN SST</span>
            <span className="kpi-badge thermal">Surface Heat</span>
          </div>
          <div className="kpi-value primary">{hasObservations ? `${summary.mean_sst.toFixed(2)}°C` : "Unavailable"}</div>
          <div className="kpi-subtitle">{hasObservations ? `Min: ${summary.min_sst.toFixed(2)}°C · Max: ${summary.max_sst.toFixed(2)}°C` : "No live SST summary loaded"}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">DAILY OBSERVATION DENSITY</span>
            <span className="kpi-badge">Spatial Grid</span>
          </div>
          <div className="kpi-value">{hasObservations ? <>{Math.round(summary.observation_count / daily.length).toLocaleString()} <small>/ day</small></> : "Unavailable"}</div>
          <div className="kpi-subtitle">Average persisted grid observations per day</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">TEMPORAL WINDOW</span>
            <span className="kpi-badge">Ground Truth</span>
          </div>
          <div className="kpi-value small">{hasObservations ? `${coverageStart} – ${coverageEnd}` : "Unavailable"}</div>
          <div className="kpi-subtitle">{hasObservations ? `Start: ${coverageStart} · End: ${coverageEnd}` : "No observed date range loaded"}</div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div>
            <h3>Monthly SST Trend{hasObservations ? ` · ${coverageStart.slice(0, 4)}–${coverageEnd.slice(0, 4)} Coverage` : ""}</h3>
            <p className="section-desc">
              Weighted monthly mean SST across persisted NOAA grid observations. Each bar represents one month with acquired data.
            </p>
          </div>
        </div>
        {!hasObservations && <div className="empty-state-panel" role="status">NOAA observations are unavailable. Start the API and ingest NOAA data to view the monthly and daily charts.</div>}
        <div className="timeseries-chart-wrapper monthly-chart">
          <div className="chart-y-axis">
            <span>{monthlyMax.toFixed(2)}°C</span>
            <span>{((monthlyMax + monthlyMin) / 2).toFixed(2)}°C</span>
            <span>{monthlyMin.toFixed(2)}°C</span>
          </div>
          <div className="timeseries-bars">
            {monthly.map((month) => {
              const heightPct = Math.max(15, Math.min(95, ((month.mean_sst - monthlyMin) / monthlyRange) * 80 + 15));
              return (
                <div
                  key={month.month}
                  className={`bar-column ${selectedMonth === month.month ? "selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedMonth === month.month}
                  aria-label={`${month.month}: mean SST ${month.mean_sst.toFixed(2)} degrees Celsius; click for monthly details`}
                  onClick={() => {
                    setSelectedMonth(month.month);
                    setSelectedDay(null);
                    setSearchTerm(month.month);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedMonth(month.month);
                      setSelectedDay(null);
                      setSearchTerm(month.month);
                    }
                  }}
                >
                  <div className="bar-tooltip">
                    <strong>{month.month}</strong>
                    <span>Mean SST: {month.mean_sst.toFixed(3)}°C</span>
                    {month.mean_anomaly !== null && <span>Mean anomaly: {month.mean_anomaly > 0 ? "+" : ""}{month.mean_anomaly.toFixed(3)}°C</span>}
                    <span>Records: {month.count.toLocaleString()}</span>
                  </div>
                  <div className="bar-fill" style={{ height: `${heightPct}%`, background: `linear-gradient(180deg, hsl(${Math.round(200 - (month.mean_sst - monthlyMin) / monthlyRange * 160)}, 85%, 55%) 0%, #0d384e 100%)` }} />
                  <span className="bar-label">{month.month}</span>
                </div>
              );
            })}
          </div>
        </div>
        {selectedMonthData && (
          <div className="chart-selection-panel" aria-live="polite">
            <div>
              <strong>{selectedMonthData.month} monthly details</strong>
              <span>Mean SST: {selectedMonthData.mean_sst.toFixed(3)}°C</span>
              <span>
                Mean SST anomaly: {selectedMonthData.mean_anomaly === null
                  ? "unavailable"
                  : `${selectedMonthData.mean_anomaly > 0 ? "+" : ""}${selectedMonthData.mean_anomaly.toFixed(3)}°C`}
              </span>
              <span>{selectedMonthData.count.toLocaleString()} observations across {selectedMonthDayCount} recorded days</span>
            </div>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                setSelectedMonth(null);
                setSearchTerm("");
              }}
            >
              Clear month selection
            </button>
          </div>
        )}
      </div>

      <div className="section-card">
        <div className="section-header">
          <div>
            <div className="badge-row">
              <span className="badge-pill ml-pill">LSTM SST FORECAST</span>
              <span className="badge-pill r2-pill">1 / 3 / 7 days</span>
            </div>
            <h3>Ocean Explorer Forecast Workbench</h3>
            <p className="section-desc">
              Run the validated statistical forecast for the nearest representative NOAA grid cell. Forecast output is not an observed measurement.
            </p>
          </div>
        </div>
        <div className="prediction-form-row">
          <div className="form-group">
            <label htmlFor="ocean-forecast-latitude">Latitude:</label>
            <input id="ocean-forecast-latitude" className="input-select" type="number" min="5" max="26" step="0.25" value={forecastLatitude} onChange={(event) => setForecastLatitude(event.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="ocean-forecast-longitude">Longitude:</label>
            <input id="ocean-forecast-longitude" className="input-select" type="number" min="50" max="78" step="0.25" value={forecastLongitude} onChange={(event) => setForecastLongitude(event.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="ocean-forecast-date">Observed through:</label>
            <input id="ocean-forecast-date" className="input-select" type="date" min={earliestForecastDate} max={coverageEnd} value={forecastDate} onChange={(event) => setForecastDate(event.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="ocean-forecast-horizon">Horizon:</label>
            <select id="ocean-forecast-horizon" className="input-select" value={forecastHorizon} onChange={(event) => setForecastHorizon(Number(event.target.value))}>
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
            </select>
          </div>
          <div className="form-action">
            <button className="btn-primary" type="button" onClick={runForecast} disabled={forecastLoading}>
              {forecastLoading ? "Forecasting..." : "Predict SST"}
            </button>
          </div>
        </div>
        {forecastMessage && <div className="prediction-advisory"><span className="info-icon">ℹ️</span><span>{forecastMessage}</span></div>}
        {forecast && (
          <div className="metrics-comparison-strip">
            <div className="metric-box highlighted"><span className="metric-tag">PREDICTED SST</span><div className="metric-big text-teal">{forecast.predicted_sst.toFixed(2)}°C</div><small>{forecast.forecast_date}</small></div>
            <div className="metric-box"><span className="metric-tag">TEST MAE</span><div className="metric-big">{forecast.evaluation_metrics.mae.toFixed(3)}°C</div><small>Chronological held-out test</small></div>
            <div className="metric-box"><span className="metric-tag">GRID CELL USED</span><div className="metric-big">{forecast.selected_grid_cell.latitude.toFixed(2)}°N</div><small>{forecast.selected_grid_cell.longitude.toFixed(2)}°E · {forecast.model_version}</small></div>
          </div>
        )}
      </div>

      {/* Interactive Timeseries Graph */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h3>Daily Mean Sea Surface Temperature Trend</h3>
            <p className="section-desc">
              Arabian Sea basin daily temperature progression. Normalized to highlight micro-variations across the monthly acquisition window.
            </p>
          </div>
          <button className="btn-secondary" onClick={downloadCSV} type="button">
            <span>📥</span> Export Daily Summary CSV
          </button>
        </div>

        <div className="timeseries-chart-wrapper">
          <div className="chart-y-axis">
            <span>{maxTemp.toFixed(2)}°C</span>
            <span>{((maxTemp + minTemp) / 2).toFixed(2)}°C</span>
            <span>{minTemp.toFixed(2)}°C</span>
          </div>

          <div className="timeseries-bars">
            {daily.map((d) => {
              const heightPct = Math.max(15, Math.min(95, ((d.mean_sst - minTemp) / tempRange) * 80 + 15));
              const isSelected = selectedDay === d.date;
              const isFirstOfMonth = d.date.endsWith("-01");
              const labelText = daily.length > 60 ? (isFirstOfMonth ? d.date.slice(2, 7) : "") : d.date.slice(8);

              return (
                <div
                  key={d.date}
                  className={`bar-column ${isSelected ? "selected" : ""}`}
                  style={{ minWidth: daily.length > 60 ? "6px" : "18px" }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${d.date}: mean SST ${d.mean_sst.toFixed(3)} degrees Celsius; click for daily details`}
                  onClick={() => {
                    setSelectedMonth(null);
                    setSelectedDay(d.date);
                    setSearchTerm(d.date);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedMonth(null);
                      setSelectedDay(d.date);
                      setSearchTerm(d.date);
                    }
                  }}
                >
                  <div className="bar-tooltip">
                    <strong>{d.date}</strong>
                    <span>SST: {d.mean_sst.toFixed(3)}°C</span>
                    {d.mean_anomaly !== null && <span>Anomaly: {d.mean_anomaly > 0 ? "+" : ""}{d.mean_anomaly.toFixed(3)}°C</span>}
                    <span>Records: {d.count.toLocaleString()}</span>
                  </div>
                  <div
                    className="bar-fill"
                    style={{
                      height: `${heightPct}%`,
                      background: `linear-gradient(180deg, hsl(${Math.round(200 - (d.mean_sst - minTemp) / tempRange * 160)}, 85%, 55%) 0%, #0d384e 100%)`,
                    }}
                  />
                  <span className="bar-label" style={{ fontSize: daily.length > 60 ? "10px" : "11px" }}>
                    {labelText}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {selectedDayData && (
          <div className="chart-selection-panel" aria-live="polite">
            <div>
              <strong>{selectedDayData.date} daily details</strong>
              <span>Mean SST: {selectedDayData.mean_sst.toFixed(3)}°C</span>
              <span>
                SST anomaly: {selectedDayData.mean_anomaly === null
                  ? "unavailable"
                  : `${selectedDayData.mean_anomaly > 0 ? "+" : ""}${selectedDayData.mean_anomaly.toFixed(3)}°C`}
              </span>
              <span>{selectedDayData.count.toLocaleString()} grid observations</span>
            </div>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                setSelectedDay(null);
                setSearchTerm("");
              }}
            >
              Clear day selection
            </button>
          </div>
        )}
      </div>

      {/* Daily Records Data Table */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h3>Daily Oceanographic Log ({daily.length} Observation Days)</h3>
            <p className="section-desc">
              NOAA High Resolution SST & Anomaly extractions for the Western Indian Ocean study sector.
            </p>
          </div>
          <div className="table-search">
            <input
              type="text"
              placeholder="Search by date (YYYY-MM-DD)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Filter daily records"
            />
          </div>
        </div>

        <div className="ocean-table-wrap">
          <table className="ocean-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Grid Observations</th>
                <th>Mean SST (°C)</th>
                <th>Mean Anomaly (°C)</th>
                <th>Thermal Status</th>
                <th>Data Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredDays.map((row) => {
                const anomaly = row.mean_anomaly ?? 0;
                const isCold = anomaly < -0.5;
                const isWarm = anomaly > 0.5;

                return (
                  <tr key={row.date} className={selectedDay === row.date ? "highlight-row" : ""}>
                    <td className="mono font-bold">{row.date}</td>
                    <td>{row.count.toLocaleString()} cells</td>
                    <td className="mono">{row.mean_sst.toFixed(3)}°C</td>
                    <td className="mono">
                      {row.mean_anomaly !== null ? (
                        <span className={`anomaly-badge ${isCold ? "cold" : isWarm ? "warm" : "neutral"}`}>
                          {row.mean_anomaly > 0 ? `+${row.mean_anomaly.toFixed(3)}` : row.mean_anomaly.toFixed(3)}°C
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className="status-pill">
                        {isCold ? "Sub-Surface Upwelling / Cooling" : isWarm ? "Elevated Surface Thermal Layer" : "Nominal Climatological Range"}
                      </span>
                    </td>
                    <td className="muted">NOAA OISST AVHRR NetCDF</td>
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
