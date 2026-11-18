import React, { useState, useEffect, useRef } from "react";
import { DigitalTwinHistory, DigitalTwinSnapshot, SSTForecast, TwinItem } from "../../types";
import { readApiJson } from "../../lib/api";

interface DigitalTwinViewProps {
  initialData: DigitalTwinSnapshot;
  apiBaseUrl: string;
}

function coverageDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({ initialData, apiBaseUrl }) => {
  const [snapshot, setSnapshot] = useState<DigitalTwinSnapshot>(initialData);
  const [selectedDate, setSelectedDate] = useState<string>(initialData.selected_date ?? coverageDate(initialData.coverage?.start));
  const [dates, setDates] = useState<string[]>(initialData.selected_date ? [initialData.selected_date] : []);
  const [isDatesLoading, setIsDatesLoading] = useState<boolean>(true);
  const [selectedPoint, setSelectedPoint] = useState<TwinItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1200);
  const [scenarioDelta, setScenarioDelta] = useState<number>(0);
  const [scenarioActive, setScenarioActive] = useState<boolean>(false);
  const [scenarioData, setScenarioData] = useState<DigitalTwinSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [layerSST, setLayerSST] = useState<boolean>(true);
  const [layerAnomalies, setLayerAnomalies] = useState<boolean>(true);
  const [layerPorts, setLayerPorts] = useState<boolean>(true);
  const [layerBoundary, setLayerBoundary] = useState<boolean>(true);
  const [layerDepth, setLayerDepth] = useState<boolean>(true);
  const [viewMode3D, setViewMode3D] = useState<boolean>(true);
  const [tiltAngle, setTiltAngle] = useState<number>(24);
  const [statusMsg, setStatusMsg] = useState<string | null>(
    initialData.status === "ok" ? null : initialData.limitations?.[0] ?? "Historical NOAA data is unavailable.",
  );
  const [forecastHorizon, setForecastHorizon] = useState<number>(7);
  const [forecast, setForecast] = useState<SSTForecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState<boolean>(false);
  const [forecastMessage, setForecastMessage] = useState<string | null>(null);

  const playbackTimerRef = useRef<number | null>(null);

  const minLon = 50.0;
  const maxLon = 78.0;
  const minLat = 5.0;
  const maxLat = 26.0;

  // Project geographic coordinates into SVG viewBox (1000 x 600)
  const project = (lat: number, lon: number) => ({
    x: ((lon - minLon) / (maxLon - minLon)) * 960 + 20,
    y: 580 - ((lat - minLat) / (maxLat - minLat)) * 560,
  });

  // Load the exact dates present in the database instead of assuming a continuous range.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);
    setIsDatesLoading(true);
    fetch(`${apiBaseUrl}/ocean/twin/history`, { signal: controller.signal })
      .then(async (res) => {
        const history = await readApiJson<DigitalTwinHistory & { message?: string }>(res);
        if (!res.ok || history.status !== "ok") {
          throw new Error(history.message || "No historical observation dates are available.");
        }
        return history;
      })
      .then((history) => {
        if (cancelled) return;
        const availableDates = [...new Set(history.items.map((item) => item.date).filter(Boolean))].sort();
        setDates(availableDates);
        if (availableDates.length === 0) {
          setStatusMsg("No NOAA observation dates were returned by the history API.");
          return;
        }
        setStatusMsg(null);
        setSelectedDate((current) => availableDates.includes(current) ? current : availableDates[0]);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDates([]);
          setStatusMsg(controller.signal.aborted
            ? "Loading observed dates timed out. Check the API connection and database, then retry."
            : error instanceof Error ? error.message : "Unable to load observed dates from the API.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsDatesLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (initialData) {
      setSnapshot(initialData);
      if (initialData.selected_date) {
        setSelectedDate(initialData.selected_date);
      }
    }
  }, [initialData]);

  // Load date snapshot
  const loadDateSnapshot = async (targetDate: string, delta?: number) => {
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const url = delta && delta !== 0
        ? `${apiBaseUrl}/ocean/twin/scenario?date=${targetDate}&delta=${delta}&limit=20000`
        : `${apiBaseUrl}/ocean/twin?date=${targetDate}&limit=20000`;
      
      const res = await fetch(url);
      const data = await readApiJson<DigitalTwinSnapshot & { message?: string }>(res);
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || "Failed to fetch twin snapshot");
      if (data.status !== "ok") throw new Error(data.message || "No NOAA observations are available for this date.");
      
      if (delta && delta !== 0) {
        setScenarioData(data);
        setScenarioActive(true);
      } else {
        setSnapshot(data);
        setScenarioData(null);
        setScenarioActive(false);
      }
      setSelectedDate(targetDate);
    } catch (err) {
      setIsPlaying(false);
      setStatusMsg(err instanceof Error ? err.message : "Unable to load this ocean snapshot. Check the API connection and retry.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Playback
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = window.setInterval(() => {
        if (dates.length < 2 || isLoading) return;
        const currentIndex = dates.indexOf(selectedDate);
        const nextDate = dates[(Math.max(currentIndex, -1) + 1) % dates.length];
        void loadDateSnapshot(nextDate, scenarioActive ? scenarioDelta : undefined);
      }, playSpeed);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, playSpeed, scenarioActive, scenarioDelta, dates, selectedDate, isLoading]);

  const activeItems = (scenarioActive && scenarioData ? scenarioData.items : snapshot?.items) || [];
  const timelineJumpDates = [0, 0.25, 0.5, 0.75, 1]
    .map((fraction) => dates[Math.round((dates.length - 1) * fraction)])
    .filter((date, index, all): date is string => Boolean(date) && all.indexOf(date) === index);
  const anomalyCount = activeItems.filter((it) => it.is_anomaly).length;
  const firstObservedDate = coverageDate(snapshot.coverage?.start);
  const earliestForecastDate = (() => {
    if (!firstObservedDate) return "";
    const firstDay = new Date(`${firstObservedDate}T00:00:00Z`);
    firstDay.setUTCDate(firstDay.getUTCDate() + 29);
    return firstDay.toISOString().slice(0, 10);
  })();
  const hasForecastWindow = Boolean(
    selectedDate && earliestForecastDate && selectedDate >= earliestForecastDate,
  );

  const loadForecast = async () => {
    const latitude = selectedPoint?.latitude ?? 15;
    const longitude = selectedPoint?.longitude ?? 72;
    setForecastLoading(true);
    setForecastMessage(null);
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        horizon: String(forecastHorizon),
        date: selectedDate,
      });
      const response = await fetch(`${apiBaseUrl}/ocean/forecast?${params}`);
      const payload = await readApiJson<SSTForecast & { error?: string; message?: string }>(response);
      if (!response.ok || payload.status !== "ok") {
        throw new Error(payload.error || payload.message || "Forecast is unavailable.");
      }
      setForecast(payload);
    } catch (error) {
      setForecast(null);
      setForecastMessage(error instanceof Error ? error.message : "Forecast service is unavailable. Check the API connection and retry.");
    } finally {
      setForecastLoading(false);
    }
  };

  // Calculate dynamic temperature range for coloring safely without stack overflow
  const temps = activeItems.map((it) => it.simulated_sst ?? it.sst);
  let minTemp = 24.0;
  let maxTemp = 31.0;
  if (temps.length > 0) {
    minTemp = temps.reduce((a, b) => (b < a ? b : a), temps[0]);
    maxTemp = temps.reduce((a, b) => (b > a ? b : a), temps[0]);
  }

  const getSSTColor = (sst: number) => {
    const range = maxTemp - minTemp || 1;
    const ratio = Math.max(0, Math.min(1, (sst - minTemp) / range));
    // Color scale: 220 (deep oceanic blue) down to 10 (warm coral-orange)
    const hue = Math.round(220 - ratio * 210);
    const lightness = Math.round(38 + ratio * 20);
    return `hsl(${hue}, 88%, ${lightness}%)`;
  };

  // Coastal Landmarks in the Western Indian Study Area
  const coastalPorts = [
    { name: "Kandla Port (GJ)", lat: 23.01, lon: 70.22, state: "Gujarat" },
    { name: "Porbandar (GJ)", lat: 21.64, lon: 69.60, state: "Gujarat" },
    { name: "Mumbai Port (MH)", lat: 18.95, lon: 72.85, state: "Maharashtra" },
    { name: "Ratnagiri (MH)", lat: 16.99, lon: 73.30, state: "Maharashtra" },
    { name: "Mormugao (Goa)", lat: 15.42, lon: 73.80, state: "Goa" },
    { name: "New Mangalore (KA)", lat: 12.92, lon: 74.81, state: "Karnataka" },
    { name: "Kochi Port (KL)", lat: 9.96, lon: 76.26, state: "Kerala" },
    { name: "Vizhinjam (KL)", lat: 8.38, lon: 76.99, state: "Kerala" },
  ];

  // Detailed schematic Indian western coastline path
  // Running from Indus delta (approx 68.2E, 23.8N), Kutch, Saurashtra, Mumbai, Goa, Mangalore down to Kanyakumari (77.5E, 8.1N)
  const indianCoastlinePoints = [
    [68.3, 23.9], [69.1, 23.7], [70.2, 23.4], [70.5, 23.0], [70.0, 22.8],
    [69.0, 22.3], [68.9, 21.6], [70.1, 20.9], [71.5, 20.8], [72.1, 21.5],
    [72.6, 21.7], [72.8, 20.8], [72.8, 19.8], [72.8, 18.9], [73.2, 17.5],
    [73.5, 16.5], [73.8, 15.4], [74.3, 14.8], [74.8, 13.5], [75.0, 12.5],
    [75.8, 11.2], [76.2, 10.0], [76.7, 9.1], [77.3, 8.3], [77.5, 8.1]
  ];

  // Build coastline SVG polyline
  const coastPath = indianCoastlinePoints
    .map(([lon, lat]) => {
      const pt = project(lat, lon);
      return `${pt.x},${pt.y}`;
    })
    .join(" ");

  // Study Area polygon boundary
  const studyBoundaryPath = (snapshot.study_area?.geometry?.coordinates?.[0] || [])
    .map(([lon, lat]) => {
      const pt = project(lat, lon);
      return `${pt.x},${pt.y}`;
    })
    .join(" ");

  return (
    <div className="digital-twin-container">
      {/* Top Twin Controls Bar */}
      <div className="twin-top-controls">
        <div className="twin-date-scrubber">
          <div className="playback-buttons">
            <button
              className={`control-btn play-btn ${isPlaying ? "playing" : ""}`}
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? "Pause Playback" : "Start Historical Playback"}
              disabled={dates.length < 2}
              type="button"
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
              <span>{isPlaying ? "PAUSE" : "PLAY TIMELINE"}</span>
            </button>

            <div className="speed-selector">
              <label>Speed:</label>
              <select
                value={playSpeed}
                onChange={(e) => setPlaySpeed(Number(e.target.value))}
                aria-label="Playback speed"
              >
                <option value={2000}>0.5x</option>
                <option value={1200}>1.0x</option>
                <option value={600}>2.0x</option>
                <option value={300}>4.0x</option>
              </select>
            </div>
          </div>

          <div className="timeline-slider-wrap">
            <div className="timeline-meta">
              <span className="timeline-date-badge">
                <span className="calendar-icon">📅</span>
                <strong>{selectedDate || "No date selected"}</strong> (NOAA OISST · {isDatesLoading ? "Loading available dates…" : `${dates.length} available dates`})
              </span>
              <span className="timeline-stats">
                {activeItems.length.toLocaleString()} ocean grid cells · {anomalyCount} ML anomalies
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(dates.length - 1, 0)}
              value={Math.max(0, dates.indexOf(selectedDate))}
              disabled={dates.length < 2}
              onChange={(e) => {
                const newDate = dates[Number(e.target.value)];
                loadDateSnapshot(newDate, scenarioActive ? scenarioDelta : undefined);
              }}
              className="timeline-slider"
              aria-label="Historical Date Timeline"
            />
            <div className="timeline-ticks">
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                const date = dates[Math.min(Math.round((dates.length - 1) * fraction), Math.max(dates.length - 1, 0))];
                return <span key={fraction}>{date ? date.slice(0, 7) : isDatesLoading ? "Loading…" : "No dates"}</span>;
              })}
            </div>
            <div className="timeline-quick-jumps">
              <span className="quick-jump-label">Jump to:</span>
              {timelineJumpDates.map((jumpDate) => (
                <button
                  key={jumpDate}
                  type="button"
                  className={`quick-jump-chip ${selectedDate === jumpDate ? "active" : ""}`}
                  disabled={isLoading || isDatesLoading}
                  onClick={() => loadDateSnapshot(jumpDate, scenarioActive ? scenarioDelta : undefined)}
                >
                  {jumpDate}
                </button>
              ))}
              {!isDatesLoading && timelineJumpDates.length === 0 && <span className="timeline-no-dates">No dates loaded</span>}
            </div>
          </div>
        </div>

        {/* Hypothetical Climate Scenario Simulator */}
        <div className="scenario-simulator-card">
          <div className="scenario-header">
            <span className="scenario-icon">⚡</span>
            <div>
              <strong>Hypothetical Scenario Simulator</strong>
              <small>Uniform sensitivity perturbation</small>
            </div>
          </div>

          <div className="scenario-actions">
            <div className="preset-buttons">
              <button
                className={`preset-btn ${scenarioActive && scenarioDelta === 1.0 ? "active" : ""}`}
                onClick={() => {
                  setScenarioDelta(1.0);
                  loadDateSnapshot(selectedDate, 1.0);
                }}
                type="button"
              >
                +1.0°C Warming
              </button>
              <button
                className={`preset-btn ${scenarioActive && scenarioDelta === 2.0 ? "active" : ""}`}
                onClick={() => {
                  setScenarioDelta(2.0);
                  loadDateSnapshot(selectedDate, 2.0);
                }}
                type="button"
              >
                +2.0°C Extreme
              </button>
              <button
                className={`preset-btn ${scenarioActive && scenarioDelta === -1.0 ? "active" : ""}`}
                onClick={() => {
                  setScenarioDelta(-1.0);
                  loadDateSnapshot(selectedDate, -1.0);
                }}
                type="button"
              >
                -1.0°C Upwelling
              </button>
            </div>

            <div className="custom-delta-control">
              <label>Custom ΔT (°C):</label>
              <input
                type="number"
                min="-5"
                max="5"
                step="0.5"
                value={scenarioDelta}
                onChange={(e) => setScenarioDelta(Number(e.target.value))}
              />
              <button
                className="btn-apply-scenario"
                onClick={() => loadDateSnapshot(selectedDate, scenarioDelta)}
                type="button"
              >
                Apply
              </button>
              {scenarioActive && (
                <button
                  className="btn-reset-scenario"
                  onClick={() => loadDateSnapshot(selectedDate, undefined)}
                  type="button"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="section-card twin-forecast-card">
        <div className="section-header">
          <div>
            <div className="badge-row">
              <span className="badge-pill ml-pill">EXPERIMENTAL LSTM</span>
              <span className="badge-pill r2-pill">Statistical model</span>
            </div>
            <h3>SST Forecast Layer</h3>
            <p className="section-desc">
              Experimental forecast for the nearest representative NOAA grid cell using a 30-day observation window.
              The saved evaluation shows persistence has lower error at all three horizons. A compatible TensorFlow runtime is required.
            </p>
          </div>
        </div>
        <div className="prediction-form-row">
          <div className="form-group">
            <label htmlFor="twin-forecast-horizon">Forecast horizon:</label>
            <select
              id="twin-forecast-horizon"
              className="input-select"
              value={forecastHorizon}
              onChange={(event) => setForecastHorizon(Number(event.target.value))}
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
            </select>
          </div>
          <div className="form-action">
            <button className="btn-primary" type="button" onClick={loadForecast} disabled={forecastLoading || !hasForecastWindow}>
              {forecastLoading ? "Forecasting..." : hasForecastWindow ? "Run LSTM Forecast" : "30-Day History Needed"}
            </button>
          </div>
        </div>
        {!hasForecastWindow && earliestForecastDate && (
          <div className="prediction-advisory">
            The first forecast date supported by the available history is {earliestForecastDate}. Select that date or a later observed date.
          </div>
        )}
        {forecastMessage && (
          <div className="prediction-advisory">
            <span className="info-icon">ℹ️</span>
            <span>{forecastMessage}</span>
          </div>
        )}
        {forecast && (
          <div className="metrics-comparison-strip">
            <div className="metric-box highlighted">
              <span className="metric-tag">PREDICTED SST</span>
              <div className="metric-big text-teal">{forecast.predicted_sst.toFixed(2)}°C</div>
              <small>{forecast.forecast_date} · {forecast.forecast_horizon_days}-day horizon</small>
            </div>
            <div className="metric-box">
              <span className="metric-tag">TEST MAE</span>
              <div className="metric-big">{forecast.evaluation_metrics.mae.toFixed(3)}°C</div>
              <small>Held-out chronological test set</small>
            </div>
            <div className="metric-box">
              <span className="metric-tag">TRAINING COVERAGE</span>
              <div className="metric-big">{forecast.training_coverage.distinct_days} days</div>
              <small>Model {forecast.model_version}</small>
            </div>
          </div>
        )}
      </div>

      {/* Advisory Banner for Scenario / Status */}
      {scenarioActive && (
        <div className="scenario-advisory-banner">
          <span className="advisory-icon">⚠️</span>
          <div className="advisory-text">
            <strong>HYPOTHETICAL SIMULATION ACTIVE:</strong> Grid cell Sea Surface Temperatures uniformly perturbed by{" "}
            <b>{scenarioDelta > 0 ? `+${scenarioDelta}` : scenarioDelta}°C</b> ({activeItems.length.toLocaleString()} cells).
            <span> This is an experimental sensitivity test, not a hydrodynamic or ocean circulation model.</span>
          </div>
        </div>
      )}

      {statusMsg && <div className="status-banner error">{statusMsg}</div>}

      {/* Main Map View & Inspector Side-by-Side */}
      <div className="twin-workspace-grid">
        {/* Geographic Map Canvas */}
        <div className="twin-map-container">
          {/* Layer Toggle Bar */}
          <div className="map-toolbar">
            <span className="map-title-tag">ARABIAN SEA & WEST INDIAN CONTINENTAL SHELF</span>
            <div className="layer-toggles">
              <button
                className={`toggle-chip view-3d-toggle-btn ${viewMode3D ? "active-3d" : ""}`}
                onClick={() => setViewMode3D(!viewMode3D)}
                type="button"
                title={viewMode3D ? "Switch to 2D Top-Down View" : "Switch to 3D Perspective Ocean View"}
              >
                <span>{viewMode3D ? "🧊 3D Perspective (ON)" : "🗺️ 2D Flat Map"}</span>
              </button>

              {viewMode3D && (
                <button
                  className="toggle-chip tilt-angle-btn"
                  onClick={() => setTiltAngle((prev) => (prev === 24 ? 35 : prev === 35 ? 16 : 24))}
                  type="button"
                  title="Cycle Camera Pitch Angle"
                >
                  <span>Pitch: {tiltAngle}°</span>
                </button>
              )}

              <label className="toggle-chip">
                <input
                  type="checkbox"
                  checked={layerSST}
                  onChange={(e) => setLayerSST(e.target.checked)}
                />
                <span>SST Heatmap ({minTemp.toFixed(1)}–{maxTemp.toFixed(1)}°C)</span>
              </label>

              <label className="toggle-chip">
                <input
                  type="checkbox"
                  checked={layerAnomalies}
                  onChange={(e) => setLayerAnomalies(e.target.checked)}
                />
                <span className="anomaly-chip-label">
                  <span className="anomaly-dot" /> ML Anomalies ({anomalyCount})
                </span>
              </label>

              <label className="toggle-chip">
                <input
                  type="checkbox"
                  checked={layerPorts}
                  onChange={(e) => setLayerPorts(e.target.checked)}
                />
                <span>Major Ports & Coastline</span>
              </label>

              <label className="toggle-chip">
                <input
                  type="checkbox"
                  checked={layerBoundary}
                  onChange={(e) => setLayerBoundary(e.target.checked)}
                />
                <span>Study Domain (EEZ)</span>
              </label>

              <label className="toggle-chip depth-toggle">
                <input
                  type="checkbox"
                  checked={layerDepth}
                  onChange={(e) => setLayerDepth(e.target.checked)}
                />
                <span>3D Relief Stems</span>
              </label>
            </div>
          </div>

          {/* 3D Perspective Stage Container */}
          <div
            className={`twin-3d-stage ${viewMode3D ? "is-3d" : "is-2d"}`}
            style={{ "--twin-pitch": `${tiltAngle}deg` } as React.CSSProperties}
          >
            {/* SVG Map Visualization */}
            <div className="svg-map-wrapper">
              <svg
                className="arabian-sea-svg"
                viewBox="0 0 1000 600"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Arabian Sea Ocean Digital Twin Interactive Map"
              >
                <defs>
                  {/* Deep Bathymetric Ocean Gradient */}
                  <radialGradient id="oceanBg" cx="35%" cy="55%" r="75%">
                    <stop offset="0%" stopColor="#0b2438" />
                    <stop offset="45%" stopColor="#081b29" />
                    <stop offset="100%" stopColor="#040e16" />
                  </radialGradient>

                  {/* Shimmer Light Reflection Wave Overlay */}
                  <linearGradient id="shimmerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                    <stop offset="45%" stopColor="#0df2c9" stopOpacity="0.06" />
                    <stop offset="55%" stopColor="#67e8f9" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                  </linearGradient>

                  {/* Atmospheric Horizon Depth Blur Gradient */}
                  <linearGradient id="horizonFog" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#030a10" stopOpacity="0.85" />
                    <stop offset="70%" stopColor="#051726" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#0b2438" stopOpacity="0" />
                  </linearGradient>

                  {/* Landmass Texture Gradient */}
                  <linearGradient id="landGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#152834" />
                    <stop offset="100%" stopColor="#0d1b24" />
                  </linearGradient>

                  {/* Anomaly Glow Filter */}
                  <filter id="anomalyGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id="surfaceGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="10" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Ocean Basin Background */}
                <rect x="0" y="0" width="1000" height="600" fill="url(#oceanBg)" />

                {/* Open Water Wave Shimmer Reflection */}
                <rect x="0" y="0" width="1000" height="600" fill="url(#shimmerGrad)" className="ocean-shimmer-plane" pointerEvents="none" />

                {/* Atmospheric Horizon Haze (only in 3D perspective mode) */}
                {viewMode3D && (
                  <rect x="0" y="0" width="1000" height="110" fill="url(#horizonFog)" pointerEvents="none" />
                )}

                {/* Perspective cues make the geographic surface read as a 3D-style
                    scientific viewport without inventing a depth measurement. */}
                <ellipse cx="510" cy="320" rx="430" ry="210" fill="#087f9d" fillOpacity="0.07" filter="url(#surfaceGlow)" />
              {layerDepth && (
                <g className="bathymetry-contours" aria-hidden="true">
                  <ellipse cx="510" cy="320" rx="400" ry="184" fill="none" stroke="#38bdf8" strokeOpacity="0.16" strokeWidth="1" />
                  <ellipse cx="510" cy="320" rx="330" ry="150" fill="none" stroke="#38bdf8" strokeOpacity="0.13" strokeWidth="1" />
                  <ellipse cx="510" cy="320" rx="260" ry="116" fill="none" stroke="#38bdf8" strokeOpacity="0.1" strokeWidth="1" />
                  <path d="M110 410 Q510 245 910 410" fill="none" stroke="#67e8f9" strokeOpacity="0.12" strokeDasharray="4 8" />
                  <path d="M160 465 Q510 315 860 465" fill="none" stroke="#67e8f9" strokeOpacity="0.1" strokeDasharray="4 8" />
                </g>
              )}

              {/* Coordinate Grid (Parallels & Meridians) */}
              {[10, 15, 20, 25].map((lat) => {
                const pt = project(lat, minLon);
                return (
                  <g key={`lat-${lat}`}>
                    <line x1="20" y1={pt.y} x2="980" y2={pt.y} stroke="#1b3c4f" strokeWidth="0.8" strokeDasharray="3 4" />
                    <text x="24" y={pt.y - 4} fill="#5a7d90" fontSize="10" fontFamily="monospace">{lat}°N</text>
                  </g>
                );
              })}

              {[55, 60, 65, 70, 75].map((lon) => {
                const pt = project(minLat, lon);
                return (
                  <g key={`lon-${lon}`}>
                    <line x1={pt.x} y1="20" x2={pt.x} y2="580" stroke="#1b3c4f" strokeWidth="0.8" strokeDasharray="3 4" />
                    <text x={pt.x + 4} y="574" fill="#5a7d90" fontSize="10" fontFamily="monospace">{lon}°E</text>
                  </g>
                );
              })}

              {/* Study Area Polygon */}
              {layerBoundary && studyBoundaryPath && (
                <polygon
                  points={studyBoundaryPath}
                  fill="#0df2c9"
                  fillOpacity="0.04"
                  stroke="#0df2c9"
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                />
              )}

              {/* Surrounding Landmass Hints */}
              {/* Arabian Peninsula / Oman Coastline (approx 50E to 60E, 15N to 25N) */}
              <path
                d="M 20 20 L 180 20 L 320 180 L 260 320 L 150 420 L 20 450 Z"
                fill="url(#landGrad)"
                stroke="#2a4556"
                strokeWidth="1"
                opacity="0.6"
              />
              <text x="80" y="240" fill="#4d6f82" fontSize="13" fontWeight="600" letterSpacing="2">OMAN & ARABIAN GULF</text>

              {/* Indian Subcontinent Landmass Polygon (East of Coastline) */}
              <polygon
                points={`${coastPath} 980,580 980,20 620,20`}
                fill="url(#landGrad)"
                stroke="#33566d"
                strokeWidth="1.2"
              />
              <text x="780" y="220" fill="#527d96" fontSize="15" fontWeight="700" letterSpacing="3">PENINSULAR INDIA</text>
              <text x="800" y="245" fill="#3c6075" fontSize="11">Gujarat · Maharashtra · Goa · Karnataka · Kerala</text>

              {/* Indian Western Coastline Highlight */}
              {layerPorts && (
                <polyline
                  points={coastPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              )}

              {/* Sea Surface Temperature Grid Points */}
              {layerSST &&
                activeItems.map((item, idx) => {
                  const pt = project(item.latitude, item.longitude);
                  const sstVal = item.simulated_sst ?? item.sst;
                  const isAnomaly = item.is_anomaly;

                  const elevation = layerDepth
                    ? 5 + ((sstVal - minTemp) / (maxTemp - minTemp || 1)) * 18
                    : 0;
                  const showDepthStem = layerDepth && !isAnomaly && idx % 18 === 0;

                  // Render normal points
                  if (!isAnomaly) {
                    return (
                      <g key={`cell-${item.observation_id || idx}`} className="ocean-grid-cell" onClick={() => setSelectedPoint(item)}>
                        {showDepthStem && (
                          <>
                            <line x1={pt.x} y1={pt.y} x2={pt.x} y2={pt.y + elevation} className="sst-depth-stem" />
                            <ellipse cx={pt.x} cy={pt.y + elevation} rx="3.8" ry="1.5" className="sst-depth-shadow" />
                          </>
                        )}
                        <circle cx={pt.x} cy={pt.y - elevation * 0.35} r={2.2} fill={getSSTColor(sstVal)} opacity={0.86} />
                        <title>{`Obs #${item.observation_id} | ${sstVal.toFixed(2)}°C | (${item.latitude.toFixed(2)}°N, ${item.longitude.toFixed(2)}°E)`}</title>
                      </g>
                    );
                  }
                  return null;
                })}

              {/* Machine Learning Isolation Forest Anomalies (Top Layer) */}
              {layerAnomalies &&
                activeItems
                  .filter((it) => it.is_anomaly)
                  .map((item) => {
                    const pt = project(item.latitude, item.longitude);
                    const sstVal = item.simulated_sst ?? item.sst;
                    const isHigh = item.severity === "high" || (item.anomaly_score && item.anomaly_score <= -0.05);
                    const elevation = layerDepth
                      ? 8 + ((sstVal - minTemp) / (maxTemp - minTemp || 1)) * 22
                      : 0;

                    return (
                      <g
                        key={`anomaly-${item.observation_id}`}
                        className="anomaly-marker-group"
                        onClick={() => setSelectedPoint(item)}
                        style={{ cursor: "pointer" }}
                      >
                        {layerDepth && <line x1={pt.x} y1={pt.y} x2={pt.x} y2={pt.y + elevation} className="anomaly-depth-stem" />}
                        {/* Pulsing Outer Ring */}
                        <circle
                          cx={pt.x}
                          cy={pt.y - elevation * 0.35}
                          r={isHigh ? 7 : 5}
                          fill={isHigh ? "#ff5252" : "#fbbf24"}
                          fillOpacity="0.4"
                          filter="url(#anomalyGlow)"
                          className="pulse-halo"
                        />
                        {/* Core Anomaly Pin */}
                        <circle
                          cx={pt.x}
                          cy={pt.y - elevation * 0.35}
                          r={isHigh ? 4.2 : 3.2}
                          fill={isHigh ? "#ff2a2a" : "#f59e0b"}
                          stroke="#ffffff"
                          strokeWidth="1.2"
                        />
                        <title>{`ANOMALY DETECTED | SST: ${sstVal.toFixed(2)}°C | Score: ${item.anomaly_score?.toFixed(4)} | Severity: ${item.severity || "Unclassified"}`}</title>
                      </g>
                    );
                  })}

              {forecast && (
                <g className="lstm-forecast-marker" aria-label="LSTM forecast grid cell">
                  {(() => {
                    const point = project(
                      forecast.selected_grid_cell.latitude,
                      forecast.selected_grid_cell.longitude,
                    );
                    return (
                      <>
                        <circle cx={point.x} cy={point.y} r="10" fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="3 2" />
                        <circle cx={point.x} cy={point.y} r="4" fill="#c4b5fd" stroke="#ffffff" strokeWidth="1.5" />
                        <title>{`LSTM forecast ${forecast.predicted_sst.toFixed(2)}°C for ${forecast.forecast_date}`}</title>
                      </>
                    );
                  })()}
                </g>
              )}

              {/* Major Maritime Coastal Ports */}
              {layerPorts &&
                coastalPorts.map((port) => {
                  const pt = project(port.lat, port.lon);
                  return (
                    <g key={port.name} className="port-marker">
                      <circle cx={pt.x} cy={pt.y} r="3.5" fill="#0df2c9" stroke="#04121a" strokeWidth="1.5" />
                      <circle cx={pt.x} cy={pt.y} r="1.5" fill="#ffffff" />
                      <text x={pt.x + 6} y={pt.y + 3} fill="#dcebed" fontSize="9.5" fontWeight="600" className="port-label">
                        {port.name}
                      </text>
                    </g>
                  );
                })}
            </svg>

            {/* Floating Map Legend */}
            <div className="twin-floating-legend">
              <div className="legend-3d-label"><span className="depth-icon">◇</span> 3D-style SST surface · height is visualized from temperature, not measured ocean depth</div>
              <div className="legend-row">
                <span className="legend-title">SST Gradient</span>
                <div className="gradient-bar-wrapper">
                  <span className="grad-label">{minTemp.toFixed(1)}°C</span>
                  <div className="grad-bar" />
                  <span className="grad-label">{maxTemp.toFixed(1)}°C</span>
                </div>
              </div>
              <div className="legend-row">
                <span className="legend-title">ML Anomaly:</span>
                <span className="legend-badge high">● High Severity</span>
                <span className="legend-badge mod">● Moderate</span>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Selected Observation Inspector Panel */}
        <div className="twin-inspector-panel">
          <div className="inspector-head">
            <h3>Observation Inspector</h3>
            {selectedPoint ? (
              <button className="btn-close-inspector" onClick={() => setSelectedPoint(null)} type="button">✕</button>
            ) : (
              <span className="badge-hint">Click point on map</span>
            )}
          </div>

          {selectedPoint ? (
            <div className="inspector-body">
              <div className={`anomaly-status-card ${selectedPoint.is_anomaly ? "flagged" : "normal"}`}>
                <div className="status-indicator">
                  <span className={`status-icon ${selectedPoint.is_anomaly ? "alert" : "check"}`}>
                    {selectedPoint.is_anomaly ? "⚠️" : "✓"}
                  </span>
                  <div>
                    <strong>{selectedPoint.is_anomaly ? "ML ANOMALY FLAGGED" : "NORMAL OBSERVATION"}</strong>
                    <small>
                      {selectedPoint.is_anomaly
                        ? `Isolation Forest detected statistical outlier (${selectedPoint.severity || "moderate"} severity)`
                        : "Observation conforms to standard sample baseline"}
                    </small>
                  </div>
                </div>
              </div>

              <div className="inspector-metrics-grid">
                <div className="inspector-metric">
                  <label>Sea Surface Temperature</label>
                  <span className="metric-val primary">
                    {(selectedPoint.simulated_sst ?? selectedPoint.sst).toFixed(3)}°C
                  </span>
                  {selectedPoint.simulated_sst !== undefined && (
                    <small className="diff-tag">
                      Baseline: {selectedPoint.sst.toFixed(3)}°C (Shift: {(selectedPoint.temperature_delta ?? 0) > 0 ? `+${selectedPoint.temperature_delta}` : selectedPoint.temperature_delta}°C)
                    </small>
                  )}
                </div>

                <div className="inspector-metric">
                  <label>SST Climatological Anomaly</label>
                  <span className="metric-val">
                    {selectedPoint.sst_anomaly !== null ? `${selectedPoint.sst_anomaly > 0 ? "+" : ""}${selectedPoint.sst_anomaly.toFixed(3)}°C` : "N/A"}
                  </span>
                  <small>Departure from reference climatology</small>
                </div>

                <div className="inspector-metric">
                  <label>Coordinates</label>
                  <span className="metric-val mono">
                    {selectedPoint.latitude.toFixed(3)}°N, {selectedPoint.longitude.toFixed(3)}°E
                  </span>
                  <small>Arabian Sea Western Shelf</small>
                </div>

                <div className="inspector-metric">
                  <label>Observation Timestamp</label>
                  <span className="metric-val mono">{selectedPoint.observation_time}</span>
                  <small>NOAA OISST AVHRR v2.1</small>
                </div>

                <div className="inspector-metric">
                  <label>Isolation Forest Score</label>
                  <span className="metric-val mono">
                    {selectedPoint.anomaly_score !== null ? selectedPoint.anomaly_score.toFixed(5) : "Not scored"}
                  </span>
                  <small>Unsupervised decision function</small>
                </div>

                <div className="inspector-metric">
                  <label>Database Record ID</label>
                  <span className="metric-val mono">#{selectedPoint.observation_id}</span>
                  <small>Persisted in SQLite/PostGIS</small>
                </div>
              </div>

              <div className="scientific-guardrail-box">
                <strong>Scientific Interpretation Advisory</strong>
                <p>
                  Statistical anomalies represent mathematically unusual observations within the acquired NOAA sample.
                  They do not constitute biological mortality proof or extreme weather events without independent in-situ validation.
                </p>
              </div>
            </div>
          ) : (
            <div className="inspector-empty-state">
              <div className="empty-icon">📍</div>
              <h4>No Observation Selected</h4>
              <p>
                Click any SST grid cell or ML anomaly pin on the Arabian Sea map to inspect sea surface temperature,
                climatological deviations, and Isolation Forest score breakdown.
              </p>
              <div className="quick-stats-box">
                <div className="quick-stat">
                  <span>Current Date</span>
                  <strong>{selectedDate}</strong>
                </div>
                <div className="quick-stat">
                  <span>Loaded Cells</span>
                  <strong>{activeItems.length.toLocaleString()}</strong>
                </div>
                <div className="quick-stat">
                  <span>ML Anomalies</span>
                  <strong className="text-warning">{anomalyCount}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
