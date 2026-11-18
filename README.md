# OceanFusion

OceanFusion is an AI-powered, historical-data-driven ocean digital twin for
oceanographic, fisheries, biodiversity, and molecular biodiversity insights
focused initially on the Arabian Sea and western Indian coastline.

## Development stack

- Backend: Python, Flask, SQLAlchemy, PostgreSQL/PostGIS
- Frontend: React, TypeScript, Vite
- Data and analytics: Pandas, GeoPandas, scikit-learn, Biopython
- Local infrastructure: Docker Compose

## Getting started

1. Copy `.env.example` to `.env`.
2. Docker Desktop is optional for local development. If it is unavailable,
   the backend uses `data/oceanfusion.sqlite` automatically. To use
   PostgreSQL/PostGIS, start Docker Desktop first and run
   `docker compose up -d db`, then set `DATABASE_URL` in `.env`. This project
   maps Docker PostGIS to host port `5433` to avoid conflicts with a local
   PostgreSQL service on `5432`.
3. Create a Python environment and install backend dependencies:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r backend\requirements.txt
   ```

4. Start the API:

   ```powershell
   $python313 = "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe"
   & $python313 -m flask --app backend.app:create_app run --host 127.0.0.1 --port 5000 --no-debugger --no-reload
   ```

   Use this Python 3.13 executable for the Flask process; running a bare `flask`
   command can select a different Python installation. The saved SST LSTM
   artifacts require the pinned TensorFlow 2.20 runtime, which is not installed
   for Python 3.14.

   Keep this terminal open while using the website. Check that
   `http://127.0.0.1:5000/api/health` returns JSON before starting the frontend.
   The Vite development server proxies `/api` requests to this Flask process;
   when Flask is stopped, API calls cannot load NOAA dates, scenarios, or model
   results. Use Python 3.13 for this command so the saved TensorFlow 2.20 LSTM
   artifacts can load; Python 3.14 is not supported by the pinned TensorFlow
   dependency.

5. Install and start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

The API health check is available at `http://localhost:5000/api/health`.

## Deployment configuration

### Deploy to Render

The repository includes `render.yaml`, which defines a Render static frontend,
Flask API (`oceanfusion-api-singapore`), and PostgreSQL database in Singapore so they can
communicate over Render's private network. The Flask runtime is pinned to
Python 3.13.5 because the saved TensorFlow 2.20 forecast models do not support
Python 3.14. The Blueprint uses Render's free API and database plans for a
temporary demo deployment.

1. Create a GitHub repository and push this project. The `.gitignore` excludes
   the local SQLite database and acquired NOAA files; do not force-add these
   large files.
2. In Render, create a Blueprint from that GitHub repository and select
   `render.yaml`.
3. Set the Blueprint prompts to the deployed origins: `CORS_ORIGINS` should be
   the frontend URL (for example, `https://oceanfusion-web.onrender.com`) and
   `VITE_API_BASE_URL` should be the API URL ending in `/api` (for example,
   `https://oceanfusion-api-singapore.onrender.com/api`). If Render assigns different
   URLs, use those instead. The static site must be rebuilt after changing its
   API URL.
4. After the database is ready, copy its **external** connection string from
   Render. From the project root, set it temporarily in PowerShell and import
   the existing 2024–2025 records:

   ```powershell
   $env:DATABASE_URL = "<Render external PostgreSQL connection string>"
   py -3.13 backend\scripts\migrate_sqlite_to_postgres.py
   Remove-Item Env:DATABASE_URL
   ```

   The importer copies records in batches, preserves IDs, verifies row counts,
   and refuses to overwrite a non-empty destination. Keep the connection
   string private. The local `data/oceanfusion.sqlite` is the source of the
   imported records and stays on your computer.
5. Check `https://<your-api-host>/api/health`, then open the frontend URL and
   confirm the NOAA dates and summaries load.

The database migration includes the saved NOAA observations used by the Twin
and Explorer. Daily anomaly scores can be computed from the saved Isolation
Forest model for the selected date, so the ignored 537 MB local score CSV does
not need to be uploaded. Model artifacts under `ml/saved_models` and evaluation
reports under `ml/evaluation` are included with the source deployment.

Render's free API service sleeps after 15 minutes without traffic and can take
about a minute to wake. Its local files are temporary. The free PostgreSQL
database has a 1 GB limit and expires 30 days after creation; the existing
885 MB SQLite database may expand when converted to PostgreSQL. The migration
script stops safely on an error and verifies copied row counts. This setup is
for a temporary demo, not durable hosting. See Render's [free service limits](https://render.com/docs/free)
and [Blueprint documentation](https://render.com/docs/blueprint-spec).

Build the frontend with the public API URL supplied at build time:

```powershell
cd frontend
Copy-Item .env.example .env.production
# Edit .env.production and set VITE_API_BASE_URL=https://api.example.com/api
npm run build
npm run preview -- --host 0.0.0.0
```

The frontend defaults to `http://localhost:5000/api` when
`VITE_API_BASE_URL` is not set. Vite replaces this value during the build, so
the production API URL must be configured before building.

Run the Flask API with a production WSGI server:

```powershell
waitress-serve --call --listen=0.0.0.0:5000 backend.app:create_app
```

Configure the API server's `.env` with the deployed frontend origin, without a
trailing slash:

```text
CORS_ORIGINS=https://app.example.com
```

For multiple frontend origins, separate them with commas. Verify deployment
with `GET /api/health` and an authenticated-free API request such as
`GET /api/fisheries/summary`. Do not use `flask run` as the production server.

If Docker reports that `dockerDesktopLinuxEngine` cannot be found, start
Docker Desktop and wait until its engine status is running. You can continue
without Docker using the SQLite fallback; PostGIS-specific spatial features
require PostgreSQL.

The initial data foundation includes:

- `data/metadata/source_registry.csv` for source and provenance planning
- `data/metadata/study_area.geojson` for the canonical discovery polygon
- `backend/scripts/download_noaa_oisst.py` for immutable NOAA OISST downloads

For a NOAA download preview:

```powershell
python backend\scripts\download_noaa_oisst.py --start 2025-01-01 --end 2025-01-03 --dry-run
```

Remove `--dry-run` only after reviewing the generated URLs. The downloader
accepts any inclusive date range, skips already downloaded files, retries
interrupted downloads safely, stores source files under `data/raw/noaa`, and
writes a JSON provenance manifest under `data/metadata`.

## Rapid MVP with real source data

The current rapid-delivery build includes working screens and API surfaces
for Overview, Data Hub, Ocean Explorer, Fisheries, Biodiversity, Molecular
Analysis, AI Analytics, and Reports. Live source acquisition is available for
OBIS, WoRMS, and NCBI, and NOAA files are downloaded through the OISST
provenance-aware downloader. Any module without acquired source files must
show an unavailable state; it must not be populated with invented values.

After downloading NOAA files, ingest them into the configured database:

```powershell
flask --app backend.app:create_app ingest-noaa
```

Ingest the acquired OBIS response:

```powershell
flask --app backend.app:create_app ingest-obis
```

Acquire and validate the BOLD India COI-5P reference set:

```powershell
python backend\scripts\download_bold_coi.py
python backend\scripts\validate_bold_coi.py
```

The original FASTA remains under `data/raw/bold/sequences`; validation
reports are written under `data/raw/bold/validation`. The `geo=India` query
can include terrestrial and freshwater organisms, so records must be
taxonomically reviewed before marine-only analysis.

Persist the validated BOLD records in the configured database:

```powershell
flask --app backend.app:create_app ingest-bold
```

The raw Portal export is retained at
`data/raw/bold/downloads/india_full.jsonl`. BOLD process IDs are stored with
a `BOLD:` prefix so they remain distinct from NCBI accessions. Records with
valid nucleotide characters are stored for molecular reference matching;
short sequences remain flagged in the validation report rather than being
silently deleted.

BOLD records are also classified conservatively from explicit habitat,
biome, realm, sector, and ecoregion text. The database currently reports
marine, freshwater, terrestrial, and unresolved scopes. An unresolved record
is not treated as marine evidence; use
`/api/molecular/results?scope=marine` for the explicitly marine subset.

## Initial ML experiment

The first ML pipeline is a deliberately small, leakage-safe CMFRI statewise
landing regression experiment:

```powershell
python -m ml.fisheries.train
```

It uses the statewise CSV only; the partially covered national resource-wise
workbook is excluded. Features are the reporting year, state, and the
previous year's state landing total. The final three years (2023–2025) are
held out chronologically for evaluation. Generated artifacts are written to
`data/processed/cmfri_statewise_features.csv`,
`ml/saved_models/cmfri_random_forest.joblib`, and
`ml/evaluation/cmfri_random_forest_metrics.json`.

This is an experimental baseline, not a production forecasting model. The
dataset contains only 65 statewise records, and the metrics must not be
interpreted as evidence of general forecasting performance.

The next experiment detects unusual observations within the processed NOAA
sample:

```powershell
python -m ml.ocean.train
```

It uses SST, SST anomaly, coordinates, and day of year from the persisted
`ocean_observations` table. It writes feature data and anomaly scores under
`data/processed/noaa_*`, the model under
`ml/saved_models/noaa_isolation_forest.joblib`, and metrics under
`ml/evaluation/noaa_isolation_forest_metrics.json`. The configured 1% anomaly
rate is an experiment parameter, not a claim that 1% of the ocean observations
are physically anomalous. The acquired 2024–2025 period is not a multi-decadal
climatology. The command accepts `--database-url` and otherwise honors
`DATABASE_URL`, so a configured PostgreSQL deployment is not silently replaced
with a separate SQLite database.

Anomaly results are available through:

```text
GET /api/ocean/anomalies?limit=100
GET /api/ocean/anomalies?date=2025-01-15&limit=100
```

The response includes coordinates, observed SST, NOAA SST anomaly, model score,
and a score-based display severity. The endpoint returns an explicit
`unavailable` response until the anomaly artifact has been generated. The
validation summary is written to
`ml/evaluation/noaa_anomaly_validation.json`.

The historical Digital Twin frontend consumes:

```text
GET /api/ocean/twin?date=2025-01-15&limit=20000
GET /api/ocean/twin/history?start=2025-01-01&end=2025-01-31
GET /api/ocean/twin/scenario?date=2025-01-15&delta=1
```

The React map is a historical spatial view of persisted NOAA grid cells. SST
colors, ML anomaly markers, date selection, bounding-box support, and
observation details are available; it is not a live operational ocean model.
The Digital Twin also presents a 3D-style scientific viewport with perspective
contours and temperature-based visual elevation. This improves spatial
interpretation but does not claim measured water-column depth or a physical
three-dimensional ocean simulation.
The scenario endpoint supports bounded `delta` values from -5°C to +5°C and
returns hypothetical values explicitly labeled as simulated. It does not model
currents, heat exchange, biology, atmospheric feedback, or future conditions.

## Product direction: anomaly detection and ocean digital twin

OceanFusion's primary AI capabilities are:

1. **ML-based anomaly detection** — identify observations that are unusual
   within the acquired NOAA and other validated datasets.
2. **Historical-data-driven Ocean Digital Twin** — represent the study area
   virtually, let users inspect historical conditions, overlay anomaly scores,
   and run bounded hypothetical scenarios.

The current NOAA anomaly detector is an Isolation Forest experiment. It uses
SST, SST anomaly, coordinates, and date-derived features. Its scores require
scientific interpretation; an anomaly is not automatically an environmental
disaster or confirmed physical event.

The Digital Twin will initially be historical, not real-time. NOAA data in the
current project is daily historical data for 2024–2025, not a live sensor
stream. The planned implementation order is:

1. Validate anomaly-score distributions and suspicious observations.
2. Build a spatial and temporal historical twin from persisted observations.
3. Expose anomaly locations, severity, values, and timestamps through Flask.
4. Add historical time controls and an anomaly overlay to React.
5. Add bounded temperature-perturbation scenarios with explicit uncertainty.
6. Keep Random Forest as a secondary model until longer historical coverage
   supports a meaningful prediction target.

The first Digital Twin release must not claim live ocean monitoring, causal
environmental explanations, or reliable future forecasts.
For candidate identification against that subset, send the FASTA upload to
`/api/molecular/identify?scope=marine`.
Candidate matching defaults to valid marine references, filters by marker when
`marker` is supplied, and narrows candidates to sequences within a length
window before alignment. Use `scope=all` only for explicit diagnostic work.

Ingest the supplied CMFRI landings files:

```powershell
flask --app backend.app:create_app ingest-cmfri
```

This imports the 65 statewise records from 2013–2025 and the explicitly
transcribed national resource-wise records in the partial workbook
(2024–2025). The unpopulated 2015–2023 workbook coverage rows are not
converted into invented zero values.

The Ocean Explorer then reads persisted records from:

- `/api/ocean/summary`
- `/api/ocean/observations`

Additional API endpoints:

- `/api/overview`
- `/api/ocean/summary`
- `/api/fisheries/summary`
- `/api/fisheries/predict?year=2026&state=Kerala`
- `/api/biodiversity/summary`
- `/api/molecular/results`
- `/api/molecular/validate`
- `/api/analytics/correlation`
- `/api/analytics/coverage`
- `/api/reports`
- `/api/live/obis`
- `/api/live/worms?name=Rastrelliger%20kanagurta`
- `/api/live/ncbi?term=marine%20fish%20COI`

The fisheries prediction endpoint uses the trained CMFRI Random Forest artifact
and persisted statewise records to create one prediction per state. It requires
the target year and optionally accepts a state filter. It is an experimental
regression result, not a production forecast; resource-wise records are not
included.

The three-model registry and evaluation metadata are available through:

```text
GET /api/ml/models
GET /api/ml/metrics
GET /api/ml/evaluation
```

The Random Forest evaluation artifact includes aggregate, per-state, and
per-year metrics. Served landing predictions are constrained to non-negative
values because negative landings are not physically meaningful.

### LSTM SST forecasting

The validated two-year archive now supports a reproducible LSTM experiment.
Use Python 3.13 with TensorFlow 2.20:

```text
py -3.13 -m ml.ocean.lstm_train --database data\oceanfusion.sqlite
GET /api/ocean/forecast?latitude=15&longitude=72&horizon=7&date=2025-01-15
```

The pipeline uses 30-day sequences from 32 deterministic representative NOAA
grid cells, chronological 70/15/15 train/validation/test splits, training-only
normalization, early stopping, and separate 1-, 3-, and 7-day models. It
compares each horizon with persistence and a lagged Random Forest baseline.
Metrics are saved to `ml/evaluation/noaa_sst_lstm_metrics.json`, preprocessing
to `ml/saved_models/noaa_sst_lstm_preprocessing.joblib`, and Keras artifacts to
`ml/saved_models/noaa_sst_lstm_h{1,3,7}.keras`.

The Digital Twin forecast marker and forecast card use the nearest trained
representative grid cell. This is a statistical SST forecast, not a physical
hydrodynamic simulation, and uncertainty is not currently estimated.

Acquire a small real reference subset:

```powershell
python backend\scripts\acquire_reference_data.py
```

CMFRI still requires source-specific file acquisition and cannot be represented
as real data until its files or access credentials are supplied.

## Data policy

Raw source data is immutable and must not be committed. Store source files
under `data/raw`, processed outputs under `data/processed`, and provenance
metadata under `data/metadata`.
