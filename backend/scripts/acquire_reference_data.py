"""Acquire small, real reference subsets from official APIs.

The output is raw API JSON and a provenance manifest. It does not claim that
the records are scientifically complete or representative.
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.live_sources import ncbi_search, obis_occurrences, worms_name


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--species", default="Rastrelliger kanagurta")
    parser.add_argument("--output", type=Path, default=Path("data/raw"))
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).isoformat()
    args.output.mkdir(parents=True, exist_ok=True)
    jobs = {}
    for filename, source_url, fetch in [
        ("obis_occurrences.json", "https://api.obis.org/v3/occurrence", lambda: obis_occurrences(100)),
        ("worms_taxonomy.json", "https://www.marinespecies.org/rest/AphiaRecordsByName", lambda: worms_name(args.species)),
        ("ncbi_nucleotide_search.json", "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", lambda: ncbi_search(f'"{args.species}"[Organism] AND COI[Gene]', 20)),
    ]:
        try:
            jobs[filename] = (source_url, fetch())
        except Exception as error:
            print(f"Skipped {filename}: {error}")
    manifest = []
    for filename, (source_url, payload) in jobs.items():
        target = args.output / filename
        target.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        manifest.append({"file": str(target), "source_url": source_url, "retrieved_at": stamp})
    (args.output / "reference_data_manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Acquired {len(jobs)} real API responses under {args.output}")


if __name__ == "__main__":
    main()
