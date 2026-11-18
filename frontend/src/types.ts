export type Module =
  | "Overview"
  | "Digital Twin"
  | "Ocean Explorer"
  | "Fisheries"
  | "Biodiversity"
  | "Molecular"
  | "AI Analytics"
  | "Data Hub"
  | "Reports";

export interface OverviewData {
  mode: string;
  kpis: {
    datasets: number;
    ocean_observations: number;
    fisheries_landings?: number;
    species_occurrences?: number;
    reference_sequences?: number;
  };
}

export interface SourceItem {
  name: string;
  provider: string;
  format: string;
  status: string;
  temporal_scope?: string;
  spatial_scope?: string;
  license?: string;
  description?: string;
}

export interface OceanSummaryData {
  mode: string;
  status: string;
  coverage: {
    start: string;
    end: string;
  };
  summary: {
    mean_sst: number;
    min_sst: number;
    max_sst: number;
    observation_count: number;
  };
  daily: Array<{
    date: string;
    mean_sst: number;
    mean_anomaly: number | null;
    count: number;
  }>;
  monthly?: Array<{
    month: string;
    mean_sst: number;
    mean_anomaly: number | null;
    count: number;
  }>;
}

export interface TwinItem {
  observation_id: number;
  observation_time: string;
  latitude: number;
  longitude: number;
  sst: number;
  simulated_sst?: number;
  temperature_delta?: number;
  sst_anomaly: number | null;
  is_anomaly: boolean;
  anomaly_score: number | null;
  severity: "high" | "moderate" | "low" | null;
}

export interface DigitalTwinSnapshot {
  mode: string;
  status: string;
  historical_only: boolean;
  selected_date: string;
  study_area: {
    type: string;
    properties: {
      name: string;
      description: string;
    };
    geometry: {
      type: string;
      coordinates: number[][][];
    };
  };
  coverage: {
    start: string | null;
    end: string | null;
  };
  filters: {
    bounds: Record<string, number>;
    limit: number;
  };
  returned_count: number;
  anomaly_artifact_status?: string;
  items: TwinItem[];
  limitations: string[];
  scenario?: {
    delta_celsius: number;
    affected_grid_cells: number;
  };
}

export interface DigitalTwinHistory {
  mode: string;
  status: string;
  range: {
    start: string;
    end: string;
  };
  items: Array<{
    date: string;
    observation_count: number;
    mean_sst: number;
    min_sst: number;
    max_sst: number;
  }>;
}

export interface FisheriesSummary {
  mode: string;
  status: string;
  summary: {
    landing_record_count: number;
    statewise_record_count: number;
    resourcewise_record_count: number;
    coverage_start: number;
    coverage_end: number;
  };
  states: Array<{
    name: string;
    landings_tonnes: number;
  }>;
  resources: Array<{
    name: string;
    landings_tonnes: number;
  }>;
  items: Array<{
    id: number;
    year: number;
    state: string | null;
    resource: string | null;
    landings_tonnes: number;
  }>;
}

export interface FisheriesPrediction {
  state: string;
  target_year: number;
  previous_year_landings_tonnes: number;
  predicted_landings_tonnes: number;
}

export interface BiodiversitySummary {
  mode: string;
  status: string;
  summary: {
    occurrence_count: number;
    species_count: number;
    taxonomy_resolved: number;
    taxonomy_total: number;
  };
  species: Array<{
    name: string;
    records: number;
    aphia_id: number | null;
  }>;
  items: Array<{
    id: number;
    scientific_name: string;
    aphia_id: number | null;
    latitude: number;
    longitude: number;
    occurrence_date: string | null;
    basis_of_record?: string;
  }>;
}

export interface SequenceMatch {
  accession: string;
  candidate_species: string;
  percent_identity: number;
  query_coverage: number;
  alignment_score: number;
}

export interface MolecularData {
  mode: string;
  status: string;
  summary: {
    reference_count: number;
    valid_count: number;
    invalid_count: number;
    returned_count: number;
    bold_count: number;
    ncbi_count?: number;
    marine_count: number;
    ecological_scope: string;
  };
  matches: SequenceMatch[];
  references: Array<{
    accession: string;
    organism: string;
    marker: string;
    sequence_length: number;
    validation_status: string;
    ecological_scope?: string;
  }>;
  message: string;
}

export interface MLEvaluationData {
  status: string;
  random_forest?: {
    model: string;
    task: string;
    feature_columns: string[];
    training_years: number[];
    test_years: number[];
    train_rows: number;
    test_rows: number;
    model_metrics: {
      mae_tonnes: number;
      rmse_tonnes: number;
      r2: number;
    };
    persistence_baseline: {
      mae_tonnes: number;
      rmse_tonnes: number;
    };
    limitations: string[];
  };
  isolation_forest?: {
    model: string;
    task: string;
    feature_columns: string[];
    record_count: number;
    date_range: {
      start: string;
      end: string;
    };
    anomaly_count: number;
    anomaly_rate: number;
    contamination_parameter: number;
    score_range: {
      min: number;
      max: number;
    };
    limitations: string[];
  };
  anomaly_validation?: {
    record_count: number;
    anomaly_count: number;
    anomaly_rate: number;
    score_quantiles: Record<string, number>;
    flagged_sst_anomaly: {
      mean: number;
      min: number;
      max: number;
    };
    top_flagged_days: Array<{
      date: string;
      count: number;
    }>;
    interpretation: string[];
  };
  forecast?: {
    status: string;
    model: string;
    coverage: {
      start: string | null;
      end: string | null;
      record_count: number;
      distinct_days: number;
    };
    minimum_required_days: number;
    horizons: number[];
    metrics_by_horizon?: Record<string, {
      lstm: { mae: number; rmse: number; r2: number };
      persistence: { mae: number; rmse: number; r2: number };
      lagged_random_forest: { mae: number; rmse: number; r2: number };
    }>;
    message: string;
  };
}

export interface MLModelRegistryData {
  status: string;
  models: Array<{
    id: string;
    name: string;
    algorithm: string;
    purpose: string;
    status: "trained" | "pending" | "not_trained" | "unavailable";
    coverage?: {
      start: string | null;
      end: string | null;
      record_count: number;
      distinct_days: number;
    };
    minimum_required_days?: number;
    limitation?: string;
  }>;
}

export interface SSTForecast {
  status: string;
  model: string;
  model_version: string;
  latitude: number;
  longitude: number;
  selected_grid_cell: { latitude: number; longitude: number };
  observed_through: string;
  forecast_date: string;
  forecast_horizon_days: number;
  predicted_sst: number;
  training_coverage: { start: string; end: string; distinct_days: number };
  evaluation_metrics: { mae: number; rmse: number; r2: number };
  uncertainty: null;
  limitations: string[];
}

export interface CorrelationData {
  mode: string;
  status: string;
  aligned_periods?: number[];
  coverage: Record<
    string,
    {
      record_count: number;
      dated_record_count?: number;
      marine_record_count?: number;
      unresolved_record_count?: number;
      date_range?: { start: string | null; end: string | null };
      year_range?: { start: number | null; end: number | null };
      spatial_scope?: string;
    }
  >;
  correlations: Array<{
    left: string;
    right: string;
    coefficient: number;
    method: string;
    periods?: number[];
  }>;
  reasons: string[];
  method: string;
}

export interface QualityReportData {
  mode: string;
  status: string;
  title: string;
  coverage: Record<string, { record_count: number }>;
  quality: Record<string, number>;
  limitations: string[];
  provenance: Record<string, string>;
}
