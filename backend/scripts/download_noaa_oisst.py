"""Download immutable NOAA OISST v2.1 daily NetCDF files and write provenance."""

import argparse
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import time
from urllib.request import urlopen


BASE_URL = (
    "https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/"
    "v2.1/access/avhrr"
)


def iter_dates(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def file_url(day: date) -> str:
    filename = f"oisst-avhrr-v02r01.{day:%Y%m%d}.nc"
    return f"{BASE_URL}/{day:%Y%m}/{filename}"


def download(day: date, output_dir: Path, timeout: int) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = f"oisst-avhrr-v02r01.{day:%Y%m%d}.nc"
    target = output_dir / filename
    url = file_url(day)
    if target.exists() and target.stat().st_size > 0:
        return {"date": day.isoformat(), "url": url, "file": str(target), "status": "exists"}

    temporary = target.with_suffix(".nc.part")
    last_error = None
    for attempt in range(3):
        try:
            try:
                response = urlopen(url, timeout=timeout)
            except Exception:
                preliminary = url.replace(".nc", "_preliminary.nc")
                response = urlopen(preliminary, timeout=timeout)
                url = preliminary
            with response, temporary.open("wb") as file:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    file.write(chunk)
            temporary.replace(target)
            break
        except Exception as error:
            last_error = error
            temporary.unlink(missing_ok=True)
            if attempt < 2:
                time.sleep(2 ** attempt)
    else:
        raise RuntimeError(f"Failed to download {day.isoformat()} after 3 attempts") from last_error

    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    return {
        "date": day.isoformat(),
        "url": url,
        "file": str(target),
        "sha256": digest,
        "status": "downloaded",
    }


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", required=True, type=date.fromisoformat)
    parser.add_argument("--end", required=True, type=date.fromisoformat)
    parser.add_argument("--output", type=Path, default=Path("data/raw/noaa"))
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    if args.end < args.start:
        raise SystemExit("--end must be on or after --start")
    records = []
    for day in iter_dates(args.start, args.end):
        if args.dry_run:
            records.append({"date": day.isoformat(), "url": file_url(day), "status": "planned"})
        else:
            records.append(download(day, args.output, args.timeout))
    metadata_dir = Path("data/metadata")
    metadata_dir.mkdir(parents=True, exist_ok=True)
    manifest = metadata_dir / f"noaa_oisst_{args.start:%Y%m%d}_{args.end:%Y%m%d}.json"
    manifest.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} provenance records to {manifest}")


if __name__ == "__main__":
    main()
