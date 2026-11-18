import React, { useState } from "react";
import { BiodiversitySummary } from "../../types";

interface BiodiversityViewProps {
  data: BiodiversitySummary;
}

export const BiodiversityView: React.FC<BiodiversityViewProps> = ({ data }) => {
  const summary = data?.summary ?? {
    occurrence_count: 0,
    species_count: 0,
    taxonomy_resolved: 0,
    taxonomy_total: 0,
  };
  const species = data?.species ?? [];
  const items = data?.items ?? [];
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);

  const filteredSpecies = species.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredItems = items.filter((it) => {
    const matchesSearch = it.scientific_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSelected = selectedSpecies ? it.scientific_name === selectedSpecies : true;
    return matchesSearch && matchesSelected;
  });

  // Map coordinates projection (50E to 78E, 5N to 26N)
  const minLon = 50.0;
  const maxLon = 78.0;
  const minLat = 5.0;
  const maxLat = 26.0;

  const project = (lat: number, lon: number) => ({
    x: ((lon - minLon) / (maxLon - minLon)) * 560 + 20,
    y: 380 - ((lat - minLat) / (maxLat - minLat)) * 360,
  });

  return (
    <div className="biodiversity-container">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">TOTAL OBIS OCCURRENCES</span>
            <span className="kpi-badge">OBIS v3 API</span>
          </div>
          <div className="kpi-value">{data?.status === "ok" ? summary.occurrence_count.toLocaleString() : "Unavailable"}</div>
          <div className="kpi-subtitle">Persisted marine observation records</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">DISTINCT TAXA</span>
            <span className="kpi-badge">Biodiversity</span>
          </div>
          <div className="kpi-value primary">{data?.status === "ok" ? summary.species_count.toLocaleString() : "Unavailable"}</div>
          <div className="kpi-subtitle">Distinct scientific taxa identified</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">WORMS RESOLUTION</span>
            <span className="kpi-badge">AphiaID</span>
          </div>
          <div className="kpi-value text-teal">
            {data?.status === "ok" ? `${summary.taxonomy_resolved} / ${summary.taxonomy_total}` : "Unavailable"}
          </div>
          <div className="kpi-subtitle">World Register of Marine Species validation</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">STUDY BASIN</span>
            <span className="kpi-badge">West Coast</span>
          </div>
          <div className="kpi-value small">Arabian Sea</div>
          <div className="kpi-subtitle">Coastal and pelagic occurrence points</div>
        </div>
      </div>

      {data?.status !== "ok" && <div className="empty-state-panel" role="status">
        OBIS occurrence data is {data?.status === "empty" ? "not loaded" : "unavailable"}. Check the API and ingest the acquired OBIS records to populate this map and taxa list.
      </div>}

      <div className="bio-split-layout">
        {/* Geographic Occurrence Map */}
        <div className="section-card bio-map-card">
          <div className="section-header">
            <div>
              <h3>Arabian Sea Species Occurrence Map</h3>
              <p className="section-desc">
                Spatial distribution of marine organism sightings acquired from the Ocean Biodiversity Information System (OBIS).
              </p>
            </div>
            {selectedSpecies && (
              <button className="btn-secondary" onClick={() => setSelectedSpecies(null)} type="button">
                Clear filter: {selectedSpecies}
              </button>
            )}
          </div>

          <div className="bio-map-wrapper">
            <svg viewBox="0 0 600 400" className="bio-svg-map" role="img" aria-label="Marine species occurrence map">
              <rect width="600" height="400" fill="#081b29" rx="8" />

              {/* Grid Lines */}
              {[10, 15, 20, 25].map((lat) => {
                const pt = project(lat, minLon);
                return <line key={lat} x1="20" y1={pt.y} x2="580" y2={pt.y} stroke="#173447" strokeDasharray="3 3" />;
              })}
              {[55, 60, 65, 70, 75].map((lon) => {
                const pt = project(minLat, lon);
                return <line key={lon} x1={pt.x} y1="20" x2={pt.x} y2="380" stroke="#173447" strokeDasharray="3 3" />;
              })}

              {/* Indian Coastline outline */}
              <path
                d="M 400 30 L 450 60 L 470 120 L 485 180 L 510 240 L 530 310 L 545 370"
                fill="none"
                stroke="#2a4e66"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <text x="460" y="100" fill="#3a6078" fontSize="12" fontWeight="600">INDIA</text>
              <text x="120" y="200" fill="#2d5269" fontSize="14" fontWeight="600" letterSpacing="2">ARABIAN SEA</text>

              {/* Occurrence Markers */}
              {items.map((it) => {
                const pt = project(it.latitude, it.longitude);
                const isMatch = selectedSpecies ? it.scientific_name === selectedSpecies : true;

                return (
                  <circle
                    key={it.id}
                    cx={pt.x}
                    cy={pt.y}
                    r={isMatch ? (selectedSpecies ? 6 : 4) : 2}
                    fill={isMatch ? (selectedSpecies ? "#ff8b6b" : "#0df2c9") : "#24455a"}
                    stroke="#04121a"
                    strokeWidth="1"
                    opacity={isMatch ? 0.9 : 0.4}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedSpecies(it.scientific_name)}
                  >
                    <title>{`${it.scientific_name} | (${it.latitude.toFixed(2)}°N, ${it.longitude.toFixed(2)}°E) | ${it.occurrence_date || "Undated"}`}</title>
                  </circle>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Top Taxa List */}
        <div className="section-card bio-species-list-card">
          <div className="section-header">
            <div>
              <h3>Observed Marine Taxa</h3>
              <p className="section-desc">Click any species to highlight sightings on map</p>
            </div>
          </div>

          <div className="species-search-input">
            <input
              type="text"
              placeholder="Search scientific name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Filter taxa"
            />
          </div>

          <div className="taxa-scroll-list">
            {filteredSpecies.map((s) => {
              const isSelected = selectedSpecies === s.name;
              return (
                <div
                  key={s.name}
                  className={`taxa-list-item ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedSpecies(isSelected ? null : s.name)}
                >
                  <div className="taxa-item-left">
                    <span className="taxa-italic-name">{s.name}</span>
                    <span className="aphia-tag">
                      {s.aphia_id ? `AphiaID: ${s.aphia_id}` : "WoRMS Unresolved"}
                    </span>
                  </div>
                  <span className="taxa-count-badge">{s.records} obs</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Occurrence Catalog Table */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h3>OBIS Species Occurrence Catalog</h3>
            <p className="section-desc">
              Verified occurrence records with spatial coordinates and taxonomic provenance.
            </p>
          </div>
          <span className="table-count-tag">Showing {filteredItems.length} records</span>
        </div>

        <div className="ocean-table-wrap">
          <table className="ocean-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Scientific Name (WoRMS accepted)</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Occurrence Date</th>
                <th>Taxonomic AphiaID</th>
                <th>Verification</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.slice(0, 50).map((row) => (
                <tr key={row.id}>
                  <td className="mono">#{row.id}</td>
                  <td className="font-bold italic">{row.scientific_name}</td>
                  <td className="mono">{row.latitude.toFixed(3)}°N</td>
                  <td className="mono">{row.longitude.toFixed(3)}°E</td>
                  <td className="mono">{row.occurrence_date || "—"}</td>
                  <td>
                    {row.aphia_id ? (
                      <span className="aphia-badge">{row.aphia_id}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="status-pill success">OBIS Marine Verified</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
