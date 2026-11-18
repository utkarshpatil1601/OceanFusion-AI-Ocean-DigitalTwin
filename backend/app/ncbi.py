import json
import re
from pathlib import Path

from .live_sources import ncbi_fetch_fasta
from .models import Dataset, ReferenceSequence
from Bio.Align import PairwiseAligner


SEARCH_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "ncbi_nucleotide_search.json"
# IUPAC ambiguity symbols are valid nucleotide characters in public references.
VALID_BASES = set("ACGTURYSWKMBDHVN")


def parse_fasta(text):
    records = []
    header = None
    sequence_parts = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith(">"):
            if header is not None:
                records.append((header, "".join(sequence_parts).upper()))
            header = line[1:]
            sequence_parts = []
        else:
            sequence_parts.append(line)
    if header is not None:
        records.append((header, "".join(sequence_parts).upper()))
    return records


def _accession(header):
    return header.split()[0].split("|")[0]


def _organism(header):
    match = re.search(r"\[organism=([^\]]+)\]", header, re.IGNORECASE)
    return match.group(1) if match else None


def retrieve_ncbi_sequences(session, search_path=SEARCH_PATH):
    payload = json.loads(Path(search_path).read_text(encoding="utf-8"))
    ids = payload.get("idlist", [])
    if not ids:
        raise ValueError("NCBI search response contains no sequence IDs")
    fasta = ncbi_fetch_fasta(ids)
    dataset = session.query(Dataset).filter_by(name="NCBI nucleotide reference sequences").first()
    if dataset is None:
        dataset = Dataset(
            name="NCBI nucleotide reference sequences",
            source="NCBI",
            description="FASTA records retrieved from NCBI E-utilities",
        )
        session.add(dataset)
        session.flush()

    inserted = 0
    invalid = 0
    for header, sequence in parse_fasta(fasta):
        accession = _accession(header)
        invalid_chars = set(sequence) - VALID_BASES
        status = "valid" if sequence and not invalid_chars else "invalid"
        existing = session.query(ReferenceSequence).filter_by(accession=accession).first()
        values = {
            "organism": _organism(header),
            "marker": "COI",
            "sequence": sequence,
            "sequence_length": len(sequence),
            "source_url": "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
            "validation_status": status,
        }
        if existing:
            for key, value in values.items():
                setattr(existing, key, value)
        else:
            session.add(ReferenceSequence(accession=accession, **values))
        if status == "valid":
            inserted += 1
        else:
            invalid += 1
    session.commit()
    return inserted, invalid, len(ids)


def match_query_to_references(
    session,
    query_name,
    query_sequence,
    limit=10,
    scope="marine",
    marker=None,
    length_tolerance=0.5,
):
    query_sequence = query_sequence.upper()
    if not query_sequence or set(query_sequence) - VALID_BASES:
        raise ValueError("Query sequence is empty or contains invalid nucleotide characters")
    aligner = PairwiseAligner()
    aligner.mode = "local"
    aligner.match_score = 2
    aligner.mismatch_score = -1
    aligner.open_gap_score = -2
    aligner.extend_gap_score = -0.5
    query = session.query(ReferenceSequence).filter_by(validation_status="valid")
    if scope and scope != "all":
        query = query.filter_by(ecological_scope=scope)
    if marker:
        query = query.filter(ReferenceSequence.marker == marker)
    minimum_length = max(int(len(query_sequence) * (1 - length_tolerance)), 1)
    maximum_length = int(len(query_sequence) * (1 + length_tolerance))
    query = query.filter(
        ReferenceSequence.sequence_length >= minimum_length,
        ReferenceSequence.sequence_length <= maximum_length,
    )
    references = query.all()
    results = []
    for reference in references:
        alignment = aligner.align(query_sequence, reference.sequence)[0]
        aligned_query = sum(end - start for start, end in alignment.aligned[0])
        matches = 0
        for (q_start, q_end), (r_start, r_end) in zip(
            alignment.aligned[0], alignment.aligned[1]
        ):
            matches += sum(
                left == right
                for left, right in zip(
                    query_sequence[q_start:q_end],
                    reference.sequence[r_start:r_end],
                )
            )
        identity = (matches / aligned_query * 100) if aligned_query else 0
        coverage = aligned_query / len(query_sequence) * 100
        results.append({
            "query_name": query_name,
            "reference_sequence_id": reference.id,
            "accession": reference.accession,
            "candidate_species": reference.organism,
            "percent_identity": float(round(identity, 3)),
            "query_coverage": float(round(coverage, 3)),
            "alignment_score": float(round(float(alignment.score), 3)),
        })
    return sorted(results, key=lambda item: (item["percent_identity"], item["query_coverage"]), reverse=True)[:limit]
