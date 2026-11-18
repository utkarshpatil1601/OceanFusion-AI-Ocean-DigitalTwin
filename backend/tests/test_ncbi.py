from app.ncbi import parse_fasta
from app.models import ReferenceSequence


def test_parse_fasta_and_validate_model():
    records = parse_fasta(">ACC1 [organism=Test fish]\nACGTNN\n")

    assert records == [("ACC1 [organism=Test fish]", "ACGTNN")]
    assert ReferenceSequence(sequence_length=6, validation_status="valid").sequence_length == 6
