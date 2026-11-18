"""Acquire India BOLD records through the current Portal API.

The Portal export is JSON-lines and includes both metadata and nucleotide
sequences. The raw export is retained; only records marked COI-5P with a
usable nucleotide field are written to the derived FASTA.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


BASE_DIR = Path(__file__).resolve().parents[2] / "data" / "raw" / "bold"
DOWNLOAD_DIR = BASE_DIR / "downloads"
SEQUENCE_DIR = BASE_DIR / "sequences"
METADATA_DIR = BASE_DIR / "metadata"
QUERY = "geo:country/ocean:India"
PORTAL = "https://portal.boldsystems.org/api"


def get_json(url):
    request = Request(url, headers={"User-Agent": "OceanFusion/0.1 research MVP"})
    with urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    for directory in (DOWNLOAD_DIR, SEQUENCE_DIR, METADATA_DIR):
        directory.mkdir(parents=True, exist_ok=True)
    encoded = urlencode({"query": QUERY})
    preprocessed = get_json(f"{PORTAL}/query/preprocessor?{encoded}")
    normalized = preprocessed["successful_terms"][0]["matched"]
    query_info = get_json(
        f"{PORTAL}/query?{urlencode({'query': normalized, 'extent': 'full'})}"
    )
    query_id = query_info["query_id"]
    download_url = f"{PORTAL}/documents/{query_id}/download"
    raw_path = DOWNLOAD_DIR / "india_full.jsonl"
    fasta_path = SEQUENCE_DIR / "india_coi5p.fasta"
    total = 0
    coi_records = 0
    with urlopen(
        Request(download_url, headers={"User-Agent": "OceanFusion/0.1 research MVP"}),
        timeout=600,
    ) as response, raw_path.open("wb") as raw, fasta_path.open("w", encoding="utf-8") as fasta:
        for line in response:
            raw.write(line)
            if not line.strip():
                continue
            total += 1
            record = json.loads(line)
            sequence = (record.get("nuc") or "").replace("-", "").upper()
            if record.get("marker_code") != "COI-5P" or not sequence:
                continue
            process_id = record.get("processid") or record.get("record_id")
            if not process_id:
                continue
            description = record.get("species") or record.get("record_id") or "BOLD reference"
            fasta.write(f">{process_id}|{record.get('record_id', '')}|{description}\n")
            for start in range(0, len(sequence), 80):
                fasta.write(sequence[start:start + 80] + "\n")
            coi_records += 1
    notes = {
        "source": "BOLD Systems Portal API",
        "query": normalized,
        "query_id": query_id,
        "download_url": download_url,
        "downloaded_utc": datetime.now(timezone.utc).isoformat(),
        "raw_output": str(raw_path),
        "coi_fasta": str(fasta_path),
        "records_downloaded": total,
        "coi5p_records": coi_records,
    }
    (METADATA_DIR / "download_notes.json").write_text(
        json.dumps(notes, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(notes, indent=2))


if __name__ == "__main__":
    main()
