import React from "react";
import { Module } from "../types";

interface HeaderProps {
  activeModule: Module;
  onSelectModule: (module: Module) => void;
  databaseStats?: {
    noaaCount: number;
    fisheriesCount: number;
    referenceCount: number;
  };
}

export const Header: React.FC<HeaderProps> = ({ activeModule, databaseStats }) => {
  return (
    <header className="ocean-header">
      <div className="header-left">
        <div className="header-breadcrumb">
          <span className="crumb-root">OCEANFUSION RESEARCH PLATFORM</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">{activeModule.toUpperCase()}</span>
        </div>
        <h1 className="header-title">
          {activeModule === "Overview" && "Executive Marine Overview"}
          {activeModule === "Digital Twin" && "Historical Ocean Digital Twin"}
          {activeModule === "Ocean Explorer" && "Oceanographic SST Explorer"}
          {activeModule === "Fisheries" && "Fisheries Intelligence & ML Predictor"}
          {activeModule === "Biodiversity" && "Marine Biodiversity & Taxonomy"}
          {activeModule === "Molecular" && "Molecular Analysis & DNA Barcode Identification"}
          {activeModule === "AI Analytics" && "Machine Learning & Cross-Domain Analytics"}
          {activeModule === "Data Hub" && "Scientific Source Registry & Provenance"}
          {activeModule === "Reports" && "Data Quality Audits & Limitations"}
        </h1>
      </div>

      <div className="header-right">
        <div className="telemetry-pill">
          <span className="pulse-dot green" />
          <div className="telemetry-content">
            <span className="telemetry-label">REGION BOUNDS</span>
            <span className="telemetry-val">5°N–26°N · 50°E–78°E (Arabian Sea)</span>
          </div>
        </div>

        <div className="telemetry-pill states-pill">
          <span className="pulse-dot blue" />
          <div className="telemetry-content">
            <span className="telemetry-label">COASTAL STUDY STATES</span>
            <span className="telemetry-val">Gujarat · Maharashtra · Goa · Karnataka · Kerala</span>
          </div>
        </div>

        {databaseStats && (
          <div className="telemetry-pill stats-pill">
            <span className="pulse-dot teal" />
            <div className="telemetry-content">
              <span className="telemetry-label">INTEGRATED RECORDS</span>
              <span className="telemetry-val">{databaseStats.noaaCount.toLocaleString()} NOAA · {databaseStats.referenceCount.toLocaleString()} References</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
