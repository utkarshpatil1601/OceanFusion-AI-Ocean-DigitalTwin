from app import db
from app.models import ReferenceSequence
from app.ncbi import match_query_to_references


def test_query_matches_reference(client):
    with client.application.app_context():
        reference = ReferenceSequence(
            accession="TEST1",
            organism="Test fish",
            marker="COI",
            sequence="ACGTACGT",
            sequence_length=8,
            source_url="test",
            validation_status="valid",
            ecological_scope="marine",
        )
        db.session.add(reference)
        db.session.commit()
        matches = match_query_to_references(db.session, "query", "ACGTACGT")

    assert matches[0]["accession"] == "TEST1"
    assert matches[0]["percent_identity"] == 100.0
    assert matches[0]["query_coverage"] == 100.0


def test_matching_excludes_nonmarine_and_invalid_references(client):
    with client.application.app_context():
        db.session.add_all(
            [
                ReferenceSequence(
                    accession="FRESH",
                    sequence="ACGTACGT",
                    sequence_length=8,
                    source_url="test",
                    validation_status="valid",
                    ecological_scope="freshwater",
                ),
                ReferenceSequence(
                    accession="INVALID",
                    sequence="ACGTACGT",
                    sequence_length=8,
                    source_url="test",
                    validation_status="invalid",
                    ecological_scope="marine",
                ),
            ]
        )
        db.session.commit()
        matches = match_query_to_references(db.session, "query", "ACGTACGT")

    assert matches == []
