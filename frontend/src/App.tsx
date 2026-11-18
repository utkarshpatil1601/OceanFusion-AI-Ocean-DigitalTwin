import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { OverviewView } from "./components/Overview/OverviewView";
import { DigitalTwinView } from "./components/DigitalTwin/DigitalTwinView";
import { OceanExplorerView } from "./components/OceanExplorer/OceanExplorerView";
import { FisheriesView } from "./components/Fisheries/FisheriesView";
import { BiodiversityView } from "./components/Biodiversity/BiodiversityView";
import { MolecularView } from "./components/Molecular/MolecularView";
import { AIAnalyticsView } from "./components/AIAnalytics/AIAnalyticsView";
import { DataHubView } from "./components/DataHub/DataHubView";
import { ReportsView } from "./components/Reports/ReportsView";
import { DEFAULT_MODULE_DATA } from "./defaultData";
import { readApiJson } from "./lib/api";
import {
  BiodiversitySummary,
  CorrelationData,
  DigitalTwinSnapshot,
  FisheriesSummary,
  MolecularData,
  Module,
  OceanSummaryData,
  OverviewData,
  QualityReportData,
  SourceItem,
} from "./types";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ??
  (typeof window !== "undefined" && window.location.port === "5173"
    ? "/api"
    : "http://localhost:5000/api")
).replace(/\/+$/, "");

interface ErrorBoundaryProps {
  children: ReactNode;
  moduleName: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ModuleErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught in module ${this.props.moduleName}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="section-card">
          <div className="section-header">
            <div>
              <div className="badge-row">
                <span className="badge-pill alert-pill">MODULE DISPLAY NOTICE</span>
              </div>
              <h3>Unable to render {this.props.moduleName}</h3>
              <p className="section-desc">
                An unexpected rendering error occurred: {this.state.error?.message || "Unknown error"}
              </p>
            </div>
          </div>
          <button
            className="btn-secondary"
            onClick={() => this.setState({ hasError: false, error: null })}
            type="button"
          >
            Retry Module Render
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<Module>("Overview");
  // Initialize with honest unavailable states until the live API responds.
  const [moduleData, setModuleData] = useState<unknown>(DEFAULT_MODULE_DATA.Overview);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [databaseStats, setDatabaseStats] = useState<{
    noaaCount: number;
    fisheriesCount: number;
    referenceCount: number;
  }>({
    noaaCount: 0,
    fisheriesCount: 0,
    referenceCount: 0,
  });

  const endpoints: Record<Module, string> = {
    Overview: "/overview",
    "Digital Twin": "/ocean/twin?limit=20000",
    "Ocean Explorer": "/ocean/summary",
    Fisheries: "/fisheries/summary",
    Biodiversity: "/biodiversity/summary",
    Molecular: "/molecular/results?scope=marine",
    "AI Analytics": "/analytics/correlation",
    "Data Hub": "/sources",
    Reports: "/reports",
  };

  const handleSelectModule = (newModule: Module) => {
    setActiveModule(newModule);
    setIsLiveConnected(false);
    setApiError(null);
    // Reset the module while its live endpoint is loading.
    setModuleData(DEFAULT_MODULE_DATA[newModule]);
  };

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);

    fetch(`${API_BASE}${endpoints[activeModule]}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await readApiJson<Record<string, unknown>>(res);
      })
      .then((data) => {
        if (!isCancelled && data) {
          setModuleData(data);
          setIsLiveConnected(true);
          setApiError(null);
          if (activeModule === "Overview") {
            const ov = data as unknown as OverviewData;
            if (ov.kpis) {
              setDatabaseStats((prev) => ({
                ...prev,
                noaaCount: ov.kpis.ocean_observations ?? 0,
                fisheriesCount: ov.kpis.fisheries_landings ?? 0,
                referenceCount: ov.kpis.reference_sequences ?? 0,
              }));
            }
          }
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setIsLiveConnected(false);
          setApiError(controller.signal.aborted
            ? "The API request timed out after 45 seconds. Check that Flask is running and the database is responding."
            : err instanceof Error ? err.message : "The Flask API is unavailable. Start it on port 5000 and reload.");
          if (activeModule === "Digital Twin") {
            const sample = DEFAULT_MODULE_DATA["Digital Twin"] as DigitalTwinSnapshot;
            setModuleData({
              ...sample,
              status: "unavailable",
              selected_date: "",
              coverage: { start: null, end: null },
              returned_count: 0,
              items: [],
              limitations: ["Live API data is unavailable. Start the Flask API and reload."],
            });
          }
        }
      });

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [activeModule]);

  return (
    <div className="oceanfusion-app">
      <Sidebar activeModule={activeModule} onSelectModule={handleSelectModule} />

      <div className="ocean-main-layout">
        <Header
          activeModule={activeModule}
          onSelectModule={handleSelectModule}
          databaseStats={isLiveConnected ? databaseStats : undefined}
        />

        <main className="ocean-content-area">
          {!isLiveConnected && apiError && (
            <div className="status-banner error" role="alert">
              {apiError} Live records and metrics are unavailable until the API connects.
            </div>
          )}
          <ModuleErrorBoundary key={activeModule} moduleName={activeModule}>
            {renderActiveModule(
              activeModule,
              moduleData ?? DEFAULT_MODULE_DATA[activeModule],
              handleSelectModule,
              API_BASE
            )}
          </ModuleErrorBoundary>
        </main>
      </div>
    </div>
  );
};

function renderActiveModule(
  active: Module,
  data: unknown,
  onSelectModule: (m: Module) => void,
  apiBaseUrl: string
) {
  const safeData = data ?? DEFAULT_MODULE_DATA[active];

  switch (active) {
    case "Overview":
      return (
        <OverviewView
          data={(safeData as OverviewData) ?? DEFAULT_MODULE_DATA.Overview}
          onSelectModule={onSelectModule}
        />
      );
    case "Digital Twin":
      return (
        <DigitalTwinView
          initialData={(safeData as DigitalTwinSnapshot) ?? DEFAULT_MODULE_DATA["Digital Twin"]}
          apiBaseUrl={apiBaseUrl}
        />
      );
    case "Ocean Explorer":
      return (
        <OceanExplorerView
          data={(safeData as OceanSummaryData) ?? DEFAULT_MODULE_DATA["Ocean Explorer"]}
          apiBaseUrl={apiBaseUrl}
        />
      );
    case "Fisheries":
      return (
        <FisheriesView
          data={(safeData as FisheriesSummary) ?? DEFAULT_MODULE_DATA.Fisheries}
          apiBaseUrl={apiBaseUrl}
        />
      );
    case "Biodiversity":
      return (
        <BiodiversityView
          data={(safeData as BiodiversitySummary) ?? DEFAULT_MODULE_DATA.Biodiversity}
        />
      );
    case "Molecular":
      return (
        <MolecularView
          data={(safeData as MolecularData) ?? DEFAULT_MODULE_DATA.Molecular}
          apiBaseUrl={apiBaseUrl}
        />
      );
    case "AI Analytics":
      return (
        <AIAnalyticsView
          correlationData={(safeData as CorrelationData) ?? DEFAULT_MODULE_DATA["AI Analytics"]}
          apiBaseUrl={apiBaseUrl}
        />
      );
    case "Data Hub":
      return (
        <DataHubView
          sources={
            ((safeData as { items?: SourceItem[] })?.items) ??
            (DEFAULT_MODULE_DATA["Data Hub"] as { items: SourceItem[] }).items
          }
        />
      );
    case "Reports":
      return (
        <ReportsView
          data={(safeData as QualityReportData) ?? DEFAULT_MODULE_DATA.Reports}
        />
      );
    default:
      return (
        <OverviewView
          data={DEFAULT_MODULE_DATA.Overview as OverviewData}
          onSelectModule={onSelectModule}
        />
      );
  }
}
