import json
from datetime import datetime
from pathlib import Path

from .models import Dataset, SpeciesOccurrence


OBIS_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "obis_occurrences.json"


def ingest_obis_file(session, path=OBIS_PATH):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    dataset = session.query(Dataset).filter_by(name="OBIS marine occurrence records").first()
    if dataset is None:
        dataset = Dataset(
            name="OBIS marine occurrence records",
            source="OBIS",
            description=f"Raw response containing {payload.get('total', 0)} available records",
        )
        session.add(dataset)
        session.flush()

    inserted = 0
    skipped = 0
    for record in payload.get("results", []):
        source_id = record.get("occurrenceID") or record.get("id")
        latitude = record.get("decimalLatitude")
        longitude = record.get("decimalLongitude")
        name = record.get("scientificName")
        if not source_id or latitude is None or longitude is None or not name:
            skipped += 1
            continue
        if not (-90 <= float(latitude) <= 90 and -180 <= float(longitude) <= 180):
            skipped += 1
            continue
        if session.query(SpeciesOccurrence).filter_by(source_record_id=source_id).first():
            continue
        event_date = None
        if record.get("eventDate"):
            try:
                event_date = datetime.fromisoformat(
                    record["eventDate"].replace("Z", "+00:00")
                ).replace(tzinfo=None)
            except ValueError:
                event_date = None
        session.add(SpeciesOccurrence(
            dataset_id=dataset.id,
            occurrence_date=event_date,
            latitude=float(latitude),
            longitude=float(longitude),
            scientific_name=name,
            aphia_id=record.get("aphiaID"),
            basis_of_record=record.get("basisOfRecord"),
            source_record_id=source_id,
        ))
        inserted += 1
    session.commit()
    return inserted, skipped
