from datetime import datetime, timezone

from . import db


class Dataset(db.Model):
    __tablename__ = "datasets"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    source = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "source": self.source,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
        }


class OceanObservation(db.Model):
    __tablename__ = "ocean_observations"

    id = db.Column(db.Integer, primary_key=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey("datasets.id"), nullable=False)
    observation_time = db.Column(db.DateTime, nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    sst = db.Column(db.Float, nullable=False)
    sst_anomaly = db.Column(db.Float)
    source_record_id = db.Column(db.String(255), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "observation_time": self.observation_time.isoformat(),
            "latitude": self.latitude,
            "longitude": self.longitude,
            "sst": self.sst,
            "sst_anomaly": self.sst_anomaly,
            "source_record_id": self.source_record_id,
        }


class SpeciesOccurrence(db.Model):
    __tablename__ = "species_occurrences"

    id = db.Column(db.Integer, primary_key=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey("datasets.id"), nullable=False)
    occurrence_date = db.Column(db.DateTime)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    scientific_name = db.Column(db.String(255), nullable=False)
    aphia_id = db.Column(db.Integer)
    basis_of_record = db.Column(db.String(100))
    source_record_id = db.Column(db.String(255), nullable=False, unique=True)

    def to_dict(self):
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "occurrence_date": self.occurrence_date.isoformat() if self.occurrence_date else None,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "scientific_name": self.scientific_name,
            "aphia_id": self.aphia_id,
            "basis_of_record": self.basis_of_record,
            "source_record_id": self.source_record_id,
        }


class FisheriesLanding(db.Model):
    __tablename__ = "fisheries_landings"

    id = db.Column(db.Integer, primary_key=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey("datasets.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    state = db.Column(db.String(100))
    resource = db.Column(db.String(255))
    landings_tonnes = db.Column(db.Float, nullable=False)
    # CMFRI provenance notes can include long source workbook caveats.
    precision = db.Column(db.Text)
    source_url = db.Column(db.String(500), nullable=False)
    source_record_id = db.Column(db.String(255), nullable=False, unique=True)

    def to_dict(self):
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "year": self.year,
            "state": self.state,
            "resource": self.resource,
            "landings_tonnes": self.landings_tonnes,
            "precision": self.precision,
            "source_url": self.source_url,
            "source_record_id": self.source_record_id,
        }


class TaxonomyRecord(db.Model):
    __tablename__ = "taxonomy_records"

    id = db.Column(db.Integer, primary_key=True)
    source_name = db.Column(db.String(255), nullable=False, unique=True)
    aphia_id = db.Column(db.Integer)
    accepted_name = db.Column(db.String(255))
    status = db.Column(db.String(100))
    rank = db.Column(db.String(100))
    authority = db.Column(db.String(255))
    resolution_status = db.Column(db.String(50), nullable=False)
    source_url = db.Column(db.String(500))
    modified = db.Column(db.DateTime)

    def to_dict(self):
        return {
            "source_name": self.source_name,
            "aphia_id": self.aphia_id,
            "accepted_name": self.accepted_name,
            "status": self.status,
            "rank": self.rank,
            "authority": self.authority,
            "resolution_status": self.resolution_status,
            "source_url": self.source_url,
            "modified": self.modified.isoformat() if self.modified else None,
        }


class ReferenceSequence(db.Model):
    __tablename__ = "reference_sequences"
    __table_args__ = (
        db.Index("ix_reference_sequences_matching", "validation_status", "ecological_scope", "marker", "sequence_length"),
    )

    id = db.Column(db.Integer, primary_key=True)
    accession = db.Column(db.String(100), nullable=False, unique=True)
    organism = db.Column(db.String(255))
    marker = db.Column(db.String(100))
    sequence = db.Column(db.Text, nullable=False)
    sequence_length = db.Column(db.Integer, nullable=False)
    source_url = db.Column(db.String(500), nullable=False)
    validation_status = db.Column(db.String(50), nullable=False)
    ecological_scope = db.Column(db.String(30), nullable=False, default="unresolved")
    ecological_basis = db.Column(db.String(255))

    def to_dict(self, include_sequence=False):
        result = {
            "id": self.id,
            "accession": self.accession,
            "organism": self.organism,
            "marker": self.marker,
            "sequence_length": self.sequence_length,
            "source_url": self.source_url,
            "validation_status": self.validation_status,
            "ecological_scope": self.ecological_scope,
            "ecological_basis": self.ecological_basis,
        }
        if include_sequence:
            result["sequence"] = self.sequence
        return result


class SequenceMatch(db.Model):
    __tablename__ = "sequence_matches"

    id = db.Column(db.Integer, primary_key=True)
    query_name = db.Column(db.String(255), nullable=False)
    reference_sequence_id = db.Column(db.Integer, db.ForeignKey("reference_sequences.id"), nullable=False)
    accession = db.Column(db.String(100), nullable=False)
    candidate_species = db.Column(db.String(255))
    percent_identity = db.Column(db.Float, nullable=False)
    query_coverage = db.Column(db.Float, nullable=False)
    alignment_score = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "query_name": self.query_name,
            "accession": self.accession,
            "candidate_species": self.candidate_species,
            "percent_identity": self.percent_identity,
            "query_coverage": self.query_coverage,
            "alignment_score": self.alignment_score,
        }
