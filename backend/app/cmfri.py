import csv
from pathlib import Path

from openpyxl import load_workbook

from .models import Dataset, FisheriesLanding


BASE_DIR = Path(__file__).resolve().parents[2] / "data" / "raw" / "cmfri"
STATEWISE_PATH = BASE_DIR / "CMFRI_Statewise_Landings_5_States_2013_2025.csv"
RESOURCEWISE_PATH = BASE_DIR / "CMFRI_National_Resource_Wise_Landings_2015_2025_PARTIAL.xlsx"


def _dataset(session):
    dataset = session.query(Dataset).filter_by(name="CMFRI fisheries landings").first()
    if dataset is None:
        dataset = Dataset(
            name="CMFRI fisheries landings",
            source="CMFRI",
            description="Statewise and explicitly covered national resource-wise marine landings.",
        )
        session.add(dataset)
        session.flush()
    return dataset


def ingest_cmfri(session):
    dataset = _dataset(session)
    inserted = updated = 0

    with STATEWISE_PATH.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            source_id = f"state:{row['year']}:{row['state']}"
            values = {
                "year": int(row["year"]),
                "state": row["state"],
                "resource": None,
                "landings_tonnes": float(row["landings_tonnes"]),
                "precision": row["precision"],
                "source_url": row["official_source_url"],
            }
            existing = session.query(FisheriesLanding).filter_by(source_record_id=source_id).first()
            if existing is None:
                session.add(FisheriesLanding(dataset_id=dataset.id, source_record_id=source_id, **values))
                inserted += 1
            else:
                for key, value in values.items():
                    setattr(existing, key, value)
                updated += 1

    workbook = load_workbook(RESOURCEWISE_PATH, read_only=True, data_only=True)
    sheet = workbook["Landings_Long"]
    rows = sheet.iter_rows(values_only=True)
    headers = list(next(rows))
    for values_row in rows:
        row = dict(zip(headers, values_row))
        if not row.get("Year") or not row.get("Resource") or row.get("Landings (tonnes)") is None:
            continue
        source_id = f"resource:{row['Year']}:{row['Resource']}"
        values = {
            "year": int(row["Year"]),
            "state": None,
            "resource": str(row["Resource"]),
            "landings_tonnes": float(row["Landings (tonnes)"]),
            "precision": row["Extraction/validation status"],
            "source_url": row["Source URL"],
        }
        existing = session.query(FisheriesLanding).filter_by(source_record_id=source_id).first()
        if existing is None:
            session.add(FisheriesLanding(dataset_id=dataset.id, source_record_id=source_id, **values))
            inserted += 1
        else:
            for key, value in values.items():
                setattr(existing, key, value)
            updated += 1
    session.commit()
    return inserted, updated
