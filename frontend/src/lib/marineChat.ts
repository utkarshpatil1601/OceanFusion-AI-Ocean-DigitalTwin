// OceanFusion Marine AI Assistant — rule-based explanations using API context when available.

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface MarineDataContext {
  sstObservations: number;
  anomalyCount: number;
  fisheriesRecords: number;
  speciesOccurrences: number;
  referenceSequences: number;
  r2Score: number;
  maeValue: number;
  topAnomalyDay: string;
  meanSstFlagged: number;
  temporalCoverage: string;
  lstmStatus: string;
}

const DEFAULT_CONTEXT: MarineDataContext = {
  sstObservations: 0,
  anomalyCount: 0,
  fisheriesRecords: 0,
  speciesOccurrences: 0,
  referenceSequences: 0,
  r2Score: 0,
  maeValue: 0,
  topAnomalyDay: "unavailable",
  meanSstFlagged: 0,
  temporalCoverage: "unavailable until data is loaded",
  lstmStatus: "check model availability in AI Analytics",
};

type Rule = {
  patterns: RegExp[];
  response: (ctx: MarineDataContext, match?: RegExpMatchArray | null) => string;
};

const RULES: Rule[] = [
  {
    patterns: [/\b(hello|hi|hey|greet|start|help|who are you)\b/i],
    response: () =>
      `🌊 **OceanFusion Marine Data Assistant**\n\nI can explain the project’s NOAA observations, anomaly detection, SST forecasting, fisheries analysis, biodiversity, and molecular workflows. Current counts and model availability depend on loaded data and trained artifacts; open the relevant dashboard for those live results.`,
  },
  {
    patterns: [/\b(anomal|anomaly|anomalies|outlier|isolation forest|flagged)\b/i],
    response: (ctx) =>
      `🔴 **Isolation Forest Anomaly Detection**\n\nThe model assigns anomaly scores to NOAA SST observations using temperature, location, and date-derived features. The configured contamination value controls the model’s expected outlier fraction; it does not establish that this fraction of ocean conditions is physically abnormal.\n\nLoaded observations: ${ctx.sstObservations.toLocaleString()}. Flagged by the saved model: ${ctx.anomalyCount.toLocaleString()}. Review score distributions and NOAA SST anomalies in AI Analytics. These statistical flags are not confirmed environmental events and require independent validation.`,
  },
  {
    patterns: [/\b(lstm|forecast|horizon|deep learning|predict sst|neural)\b/i],
    response: () =>
      `🧠 **NOAA SST Forecasting**\n\nSaved experiments include 1-, 3-, and 7-day LSTM horizons using 2024–2025 observations and chronological splits. In the saved held-out results, persistence has lower MAE than the LSTM at all three horizons (1 day: 0.092 vs 0.197°C; 3 days: 0.212 vs 0.268°C; 7 days: 0.359 vs 0.384°C). This experiment does not show that LSTM is the best forecaster. The API serves a forecast only when its trained artifact, TensorFlow runtime, and input history are available.`,
  },
  {
    patterns: [/\b(sst|sea surface temperature|temperature|thermal|warm|cold|heat)\b/i],
    response: (ctx) =>
      `🌡️ **Sea Surface Temperature (SST)**\n\nNOAA OISST provides gridded sea-surface temperature observations. OceanFusion has ${ctx.sstObservations.toLocaleString()} NOAA records loaded for ${ctx.temporalCoverage}.\n\nUse **Ocean Explorer** to inspect the observed daily and monthly values. The Digital Twin is a historical view; it is not a physical ocean circulation simulation.`,
  },
  {
    patterns: [/\b(random forest|rf|fisheries|cmfri|landings?|catch|fish|yield)\b/i],
    response: (ctx) =>
      `🎣 **CMFRI Fisheries Analysis**\n\nThe database currently contains ${ctx.fisheriesRecords.toLocaleString()} fisheries landing records. The experimental Random Forest predicts annual state-level landings from historical records.\n\n${ctx.r2Score ? `The saved aggregate test R² is ${ctx.r2Score.toFixed(3)} and MAE is ${ctx.maeValue.toLocaleString()} tonnes. ` : "Evaluation metrics are unavailable. "}State-level test performance is weak for some states, so treat predictions as exploratory and review the AI Analytics evaluation before use.`,
  },
  {
    patterns: [/\b(obis|worms|species|taxa|taxonomy|biodiversity|occurrence|marine life)\b/i],
    response: (ctx) =>
      `🐠 **Biodiversity & Taxonomy**\n\nThe current database has ${ctx.speciesOccurrences.toLocaleString()} OBIS occurrence records. The Biodiversity page shows the acquired records and taxonomy resolution available for them. Record totals describe the local acquisition, not the full OBIS catalogue or sampling abundance.`,
  },
  {
    patterns: [/\b(bold|ncbi|dna|barcode|molecular|coi|fasta|genbank)\b/i],
    response: (ctx) =>
      `🧬 **Molecular DNA Barcode Workbench**\n\nThe local reference set currently contains ${ctx.referenceSequences.toLocaleString()} BOLD and NCBI records. Upload or select a FASTA sequence in **Molecular Analysis** to run local pairwise alignment. Results are candidate matches and need taxonomic review; the database’s source coverage and ecological classification are shown separately.`,
  },
  {
    patterns: [/\b(digital twin|3d|twin|elevation|bathymetry|render)\b/i],
    response: () =>
      `🌐 **Historical Ocean Digital Twin**\n\nThe Digital Twin maps acquired NOAA SST observations for the configured Arabian Sea study area. Select available dates to inspect grid cells and anomaly overlays. Its 3D-style height is a visual encoding of SST, not measured bathymetry or a physical 3D ocean simulation. Temperature scenarios are uniform hypothetical perturbations, not predictions.`,
  },
  {
    patterns: [/\b(arabian sea|gujarat|maharashtra|goa|karnataka|kerala|coast|port)\b/i],
    response: () =>
      `🗺️ **Study Area**\n\nThe configured study area covers 5°N–26°N and 50°E–78°E, including the Arabian Sea and western Indian coastal states: Gujarat, Maharashtra, Goa, Karnataka, and Kerala. Dataset coverage varies by source; open **Multi-Source Data Coverage** to compare loaded time and spatial scopes.`,
  },
  {
    patterns: [/\b(data source|provenance|database|records?|count|dataset)\b/i],
    response: (ctx) =>
      `📦 **Loaded Data Snapshot**\n\n| Source | Locally loaded records |\n|---|---:|\n| NOAA OISST | ${ctx.sstObservations.toLocaleString()} |\n| CMFRI landings | ${ctx.fisheriesRecords.toLocaleString()} |\n| OBIS occurrences | ${ctx.speciesOccurrences.toLocaleString()} |\n| BOLD and NCBI references | ${ctx.referenceSequences.toLocaleString()} |\n\nThese are local database counts, not provider-wide totals. Open **Multi-Source Data Coverage** for date and geographic coverage.`,
  },
  {
    patterns: [/\b(thank|thanks|good|awesome|great|cool|nice)\b/i],
    response: () =>
      `🙏 You're very welcome! Feel free to ask more questions about SST trends, the LSTM forecasting model, fisheries predictions, or run tests in any of the modules!`,
  },
];

const FALLBACK_RESPONSES = [
  (ctx: MarineDataContext) =>
    `🌊 I'm specialized in the OceanFusion marine platform. Current loaded counts are ${ctx.sstObservations.toLocaleString()} NOAA, ${ctx.fisheriesRecords.toLocaleString()} CMFRI, and ${ctx.speciesOccurrences.toLocaleString()} OBIS records. Forecast status: ${ctx.lstmStatus}. Open a dashboard for current source details, or ask me about a model or data topic.`,
  () =>
    `🔍 I can provide scientific explanations and data summaries for:\n• Ocean thermal patterns & upwelling dynamics\n• Isolation Forest & Random Forest model architectures\n• Marine biodiversity & taxonomic normalization\n• Arabian Sea coastal ports and EEZ boundaries\n\nWhat topic would you like to explore?`,
];

let fallbackCounter = 0;

export function getMarineResponse(userMessage: string, context: Partial<MarineDataContext> = {}): string {
  const ctx: MarineDataContext = { ...DEFAULT_CONTEXT, ...context };
  const msg = userMessage.toLowerCase().trim();

  if (!msg) return "Please enter a question about OceanFusion marine data, ML models, or oceanography.";

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = msg.match(pattern);
      if (match) {
        return rule.response(ctx, match);
      }
    }
  }

  const fb = FALLBACK_RESPONSES[fallbackCounter % FALLBACK_RESPONSES.length](ctx);
  fallbackCounter++;
  return fb;
}

export function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
