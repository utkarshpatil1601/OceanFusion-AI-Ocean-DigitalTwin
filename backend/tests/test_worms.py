from app.models import TaxonomyRecord


def test_taxonomy_record_serializes():
    record = TaxonomyRecord(
        source_name="Old name",
        accepted_name="Accepted name",
        aphia_id=123,
        resolution_status="resolved",
    )

    assert record.to_dict()["accepted_name"] == "Accepted name"
