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

export const defaultOverview: OverviewData = {
  mode: "unavailable",
  kpis: {
    datasets: 0,
    ocean_observations: 0,
    fisheries_landings: 0,
    species_occurrences: 0,
    reference_sequences: 0,
  },
};

export const defaultSources: { items: SourceItem[] } = {
  items: [
    {
      name: "NOAA OISST v2.1",
      provider: "NOAA NCEI",
      format: "NetCDF (.nc)",
      status: "Configured; availability not checked",
      temporal_scope: "2015–2025 (configured; not checked)",
      spatial_scope: "Arabian Sea study area (configured)",
    },
    {
      name: "CMFRI Landings",
      provider: "CMFRI",
      format: "CSV / XLSX",
      status: "Configured; availability not checked",
      temporal_scope: "2015–2025 (configured; not checked)",
      spatial_scope: "Western Indian coastal states (configured)",
    },
    {
      name: "OBIS Occurrences",
      provider: "OBIS",
      format: "GeoJSON / JSON",
      status: "Configured; availability not checked",
      temporal_scope: "2015–2025 (configured; not checked)",
      spatial_scope: "Arabian Sea study area (configured)",
    },
    {
      name: "WoRMS Taxonomy",
      provider: "WoRMS",
      format: "REST API / AphiaID",
      status: "Configured; availability not checked",
      temporal_scope: "Authoritative registry",
      spatial_scope: "Global marine standard",
    },
    {
      name: "BOLD Barcodes",
      provider: "BOLD Systems",
      format: "FASTA & JSONL",
      status: "Configured; availability not checked",
      temporal_scope: "Reference collection",
      spatial_scope: "Indian marine references",
    },
    {
      name: "NCBI GenBank",
      provider: "NCBI",
      format: "FASTA / Entrez",
      status: "Configured; availability not checked",
      temporal_scope: "Curated collection",
      spatial_scope: "Target commercial finfish",
    },
  ],
};

// Generates 31 days of NOAA daily summary
export const defaultOceanSummary: OceanSummaryData = {
  mode: "unavailable",
  status: "unavailable",
  coverage: {
    start: "",
    end: "",
  },
  summary: {
    mean_sst: 0,
    min_sst: 0,
    max_sst: 0,
    observation_count: 0,
  },
  daily: [],
  monthly: [],
};

// Default sample cells for the Arabian Sea
export const defaultTwinSnapshot: DigitalTwinSnapshot = {
  mode: "historical-digital-twin",
  status: "unavailable",
  historical_only: true,
  selected_date: "",
  study_area: {
    type: "Feature",
    properties: {
      name: "Arabian Sea and western Indian coastline",
      description: "MVP study area (5°N–26°N, 50°E–78°E)",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [50.0, 5.0],
          [78.0, 5.0],
          [78.0, 24.5],
          [68.0, 26.0],
          [60.0, 25.0],
          [50.0, 20.0],
          [50.0, 5.0],
        ],
      ],
    },
  },
  coverage: {
    start: null,
    end: null,
  },
  filters: {
    bounds: {},
    limit: 20000,
  },
  returned_count: 0,
  items: [],
  limitations: [
    "Live observations are unavailable until the OceanFusion API connects.",
  ],
};

export const defaultFisheriesSummary: FisheriesSummary = {
  mode: "unavailable",
  status: "unavailable",
  summary: {
    landing_record_count: 0,
    statewise_record_count: 0,
    resourcewise_record_count: 0,
    coverage_start: 0,
    coverage_end: 0,
  },
  states: [],
  resources: [],
  items: [],
};

export const defaultBiodiversitySummary: BiodiversitySummary = {
  mode: "unavailable",
  status: "unavailable",
  summary: {
    occurrence_count: 0,
    species_count: 0,
    taxonomy_resolved: 0,
    taxonomy_total: 0,
  },
  species: [],
  items: [],
};

export const defaultMolecularData: MolecularData = {
  mode: "unavailable",
  status: "unavailable",
  summary: {
    reference_count: 0,
    valid_count: 0,
    invalid_count: 0,
    returned_count: 0,
    bold_count: 0,
    ncbi_count: 0,
    marine_count: 0,
    ecological_scope: "marine",
  },
  matches: [],
  references: [],
  message: "Live molecular reference data is unavailable until the OceanFusion API connects.",
};

export const defaultCorrelationData: CorrelationData = {
  mode: "unavailable",
  status: "unavailable",
  coverage: {
    noaa: {
      record_count: 0,
      date_range: { start: null, end: null },
      spatial_scope: "Unavailable",
    },
    cmfri: {
      record_count: 0,
      year_range: { start: null, end: null },
      spatial_scope: "Unavailable",
    },
    obis: {
      record_count: 0,
      dated_record_count: 0,
      date_range: { start: null, end: null },
      spatial_scope: "Unavailable",
    },
    bold: {
      record_count: 0,
      marine_record_count: 0,
      unresolved_record_count: 0,
      spatial_scope: "Unavailable",
    },
    ncbi: {
      record_count: 0,
      spatial_scope: "Unavailable",
    },
  },
  correlations: [],
  reasons: [
    "API connection is unavailable; live source coverage has not been loaded.",
  ],
  method: "Coverage-aware annual alignment; correlation is withheld when overlap is insufficient.",
};

export const defaultReportsData: QualityReportData = {
  mode: "unavailable",
  status: "unavailable",
  title: "OceanFusion Data Quality and Coverage Report",
  coverage: {
    noaa: { record_count: 0 },
    cmfri: { record_count: 0 },
    obis: { record_count: 0 },
    worms: { record_count: 0 },
    bold: { record_count: 0 },
    ncbi: { record_count: 0 },
  },
  quality: {
    reference_valid_count: 0,
    reference_invalid_count: 0,
    taxonomy_record_count: 0,
    taxonomy_resolved_count: 0,
    taxonomy_unresolved_count: 0,
    obis_dated_count: 0,
  },
  limitations: [
    "Live report data is unavailable until the OceanFusion API connects.",
  ],
  provenance: {
    noaa: "National Oceanic and Atmospheric Administration (NOAA OISST v2.1)",
    cmfri: "Central Marine Fisheries Research Institute (CMFRI)",
    obis: "Ocean Biodiversity Information System (OBIS)",
    worms: "World Register of Marine Species (WoRMS)",
    bold: "Barcode of Life Data System (BOLD Systems)",
    ncbi: "National Center for Biotechnology Information (NCBI GenBank)",
  },
};

export const DEFAULT_MODULE_DATA: Record<Module, unknown> = {
  Overview: defaultOverview,
  "Digital Twin": defaultTwinSnapshot,
  "Ocean Explorer": defaultOceanSummary,
  Fisheries: defaultFisheriesSummary,
  Biodiversity: defaultBiodiversitySummary,
  Molecular: defaultMolecularData,
  "AI Analytics": defaultCorrelationData,
  "Data Hub": defaultSources,
  Reports: defaultReportsData,
};
