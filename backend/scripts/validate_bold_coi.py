"""Validate BOLD COI-5P FASTA records without deleting short or invalid records."""

import csv
import json
from collections import Counter
from pathlib import Path

from Bio import SeqIO


BASE_DIR = Path(__file__).resolve().parents[2] / "data" / "raw" / "bold"
FASTA = BASE_DIR / "sequences" / "india_coi5p.fasta"
REPORT_DIR = BASE_DIR / "validation"
# BOLD sequences may contain standard IUPAC ambiguity symbols.
VALID_CHARS = set("ACGTURYSWKMBDHVN")


def process_id(record):
    return record.id.split("|")[0]


def main():
    if not FASTA.exists():
        raise FileNotFoundError(f"Missing BOLD FASTA: {FASTA}")
    records = list(SeqIO.parse(FASTA, "fasta"))
    if not records:
        raise RuntimeError("BOLD FASTA contains no records.")
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    counts = Counter(process_id(record) for record in records)
    rows = []
    for record in records:
        sequence = str(record.seq).upper()
        invalid = sorted(set(sequence) - VALID_CHARS)
        duplicate = counts[process_id(record)] > 1
        rows.append(
            {
                "process_id": process_id(record),
                "description": record.description,
                "length": len(sequence),
                "valid_nucleotide_chars": not invalid,
                "invalid_chars": ",".join(invalid),
                "ambiguous_bases": sequence.count("N"),
                "duplicate_process_id": duplicate,
                "length_500_plus": len(sequence) >= 500,
                "validation_status": "valid" if not invalid and not duplicate else "flagged",
            }
        )
    report = REPORT_DIR / "bold_sequence_validation.csv"
    with report.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    summary = {
        "total_records": len(rows),
        "unique_process_ids": len(counts),
        "duplicate_records": sum(row["duplicate_process_id"] for row in rows),
        "invalid_character_records": sum(not row["valid_nucleotide_chars"] for row in rows),
        "records_below_500_bp": sum(not row["length_500_plus"] for row in rows),
        "records_passing_basic_checks": sum(row["validation_status"] == "valid" for row in rows),
        "mean_sequence_length": round(sum(row["length"] for row in rows) / len(rows), 2),
        "minimum_length": min(row["length"] for row in rows),
        "maximum_length": max(row["length"] for row in rows),
    }
    (REPORT_DIR / "bold_validation_summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
