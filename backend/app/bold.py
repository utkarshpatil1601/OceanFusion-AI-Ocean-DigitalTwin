import json
import re
from pathlib import Path

from .models import Dataset, ReferenceSequence


RAW_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "raw"
    / "bold"
    / "downloads"
    / "india_full.jsonl"
)
VALID_BASES = set("ACGTURYSWKMBDHVN")


def classify_bold_ecology(record):
    """Apply conservative classification from explicit BOLD habitat metadata."""
    fields = {
        str(record.get(key) or "").strip().lower()
        for key in ("habitat", "biome", "realm", "sector", "ecoregion", "country/ocean")
    }
    text = " | ".join(fields)
    if re.search(r"\b(marine|ocean|sea|coastal|intertidal|mangrove)\b", text):
        return "marine", "explicit habitat/ecoregion text"
    if re.search(r"\b(freshwater|fresh water|river|lake|pond)\b", text):
        return "freshwater", "explicit habitat/ecoregion text"
    if re.search(r"\b(terrestrial|forest|field|grassland|desert|garden)\b", text):
        return "terrestrial", "explicit habitat/ecoregion text"
    return "unresolved", "no explicit ecological scope"


def ingest_bold_sequences(session, raw_path=RAW_PATH):
    """Persist valid COI-5P BOLD records while retaining process IDs."""
    if not Path(raw_path).exists():
        raise FileNotFoundError(f"Missing BOLD export: {raw_path}")

    dataset = (
        session.query(Dataset)
        .filter_by(name="BOLD India COI-5P reference sequences")
        .first()
    )
    if dataset is None:
        dataset = Dataset(
            name="BOLD India COI-5P reference sequences",
            source="BOLD Systems Portal",
            description="India query export filtered to records with marker_code COI-5P.",
        )
        session.add(dataset)
        session.flush()

    existing = {
        row.accession
        for row in session.query(ReferenceSequence.accession)
        .filter(ReferenceSequence.accession.like("BOLD:%"))
        .all()
    }
    inserted = updated = invalid = skipped = 0
    with Path(raw_path).open(encoding="utf-8") as file:
        for line in file:
            if not line.strip():
                continue
            record = json.loads(line)
            if record.get("marker_code") != "COI-5P":
                continue
            sequence = (record.get("nuc") or "").replace("-", "").upper()
            process_id = record.get("processid") or record.get("record_id")
            if not process_id:
                skipped += 1
                continue
            accession = f"BOLD:{process_id}"
            status = "valid" if sequence and not set(sequence) - VALID_BASES else "invalid"
            if status == "invalid":
                invalid += 1
            ecological_scope, ecological_basis = classify_bold_ecology(record)
            values = {
                "organism": record.get("species") or record.get("genus"),
                "marker": "COI-5P",
                "sequence": sequence,
                "sequence_length": len(sequence),
                "source_url": (
                    "https://portal.boldsystems.org/api/documents/"
                    "eAFLT823Ss4vzSspqtTPT05NzLPyzEvJTLROK83JAQCdqArM/download"
                ),
                "validation_status": status,
                "ecological_scope": ecological_scope,
                "ecological_basis": ecological_basis,
            }
            if accession in existing:
                row = session.query(ReferenceSequence).filter_by(accession=accession).one()
                for key, value in values.items():
                    setattr(row, key, value)
                updated += 1
            else:
                session.add(ReferenceSequence(accession=accession, **values))
                existing.add(accession)
                inserted += 1
    session.commit()
    return inserted, updated, invalid, skipped
