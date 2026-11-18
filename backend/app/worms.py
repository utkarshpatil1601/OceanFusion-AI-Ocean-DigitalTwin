from datetime import datetime
import time

from .live_sources import worms_name
from .models import ReferenceSequence, SpeciesOccurrence, TaxonomyRecord


def _best_record(records):
    if not isinstance(records, list) or not records:
        return None
    return next(
        (record for record in records if record.get("status") == "accepted"),
        records[0],
    )


def normalize_obis_taxonomy(session, pause_seconds=0.1):
    names = [
        row[0]
        for row in session.query(SpeciesOccurrence.scientific_name)
        .distinct()
        .order_by(SpeciesOccurrence.scientific_name)
        .all()
    ]
    resolved = 0
    unresolved = 0
    for name in names:
        existing = session.query(TaxonomyRecord).filter_by(source_name=name).first()
        if existing and existing.resolution_status == "resolved":
            continue
        try:
            record = _best_record(worms_name(name))
        except Exception as error:
            record = None
            resolution_status = f"error: {type(error).__name__}"
        else:
            resolution_status = "resolved" if record else "unresolved"
        if record:
            modified = None
            if record.get("modified"):
                try:
                    modified = datetime.fromisoformat(
                        record["modified"].replace("Z", "+00:00")
                    ).replace(tzinfo=None)
                except ValueError:
                    modified = None
            values = {
                "aphia_id": record.get("valid_AphiaID") or record.get("AphiaID"),
                "accepted_name": record.get("valid_name") or record.get("scientificname"),
                "status": record.get("status"),
                "rank": record.get("rank"),
                "authority": record.get("valid_authority") or record.get("authority"),
                "resolution_status": resolution_status,
                "source_url": record.get("url"),
                "modified": modified,
            }
            if existing:
                for key, value in values.items():
                    setattr(existing, key, value)
            else:
                session.add(TaxonomyRecord(source_name=name, **values))
            resolved += 1
        else:
            if existing:
                existing.resolution_status = resolution_status
            else:
                session.add(TaxonomyRecord(source_name=name, resolution_status=resolution_status))
            unresolved += 1
        session.commit()
        time.sleep(pause_seconds)
    return resolved, unresolved, len(names)


def normalize_bold_taxonomy(session, limit=100, pause_seconds=0.1):
    """Resolve a bounded, cached batch of BOLD names through WoRMS."""
    names = [
        row[0]
        for row in session.query(ReferenceSequence.organism)
        .filter(ReferenceSequence.accession.like("BOLD:%"))
        .filter(ReferenceSequence.organism.isnot(None))
        .filter(
            ~session.query(TaxonomyRecord.source_name)
            .filter(TaxonomyRecord.source_name == ReferenceSequence.organism)
            .exists()
        )
        .distinct()
        .order_by(ReferenceSequence.organism)
        .limit(limit)
        .all()
    ]
    resolved = unresolved = cached = 0
    for name in names:
        existing = session.query(TaxonomyRecord).filter_by(source_name=name).first()
        try:
            record = _best_record(worms_name(name))
        except Exception as error:
            record = None
            resolution_status = f"error: {type(error).__name__}"
        else:
            resolution_status = "resolved" if record else "unresolved"
        if record:
            values = {
                "aphia_id": record.get("valid_AphiaID") or record.get("AphiaID"),
                "accepted_name": record.get("valid_name") or record.get("scientificname"),
                "status": record.get("status"),
                "rank": record.get("rank"),
                "authority": record.get("valid_authority") or record.get("authority"),
                "resolution_status": resolution_status,
                "source_url": record.get("url"),
            }
            if existing:
                for key, value in values.items():
                    setattr(existing, key, value)
            else:
                session.add(TaxonomyRecord(source_name=name, **values))
            resolved += 1
            if record.get("status") == "accepted":
                session.query(ReferenceSequence).filter(
                    ReferenceSequence.accession.like("BOLD:%"),
                    ReferenceSequence.organism == name,
                ).update(
                    {
                        "ecological_scope": "marine",
                        "ecological_basis": "WoRMS marine_only accepted taxon",
                    },
                    synchronize_session=False,
                )
        else:
            if existing:
                existing.resolution_status = resolution_status
            else:
                session.add(
                    TaxonomyRecord(
                        source_name=name, resolution_status=resolution_status
                    )
                )
            unresolved += 1
        session.commit()
        time.sleep(pause_seconds)
    return resolved, unresolved, cached, len(names)
