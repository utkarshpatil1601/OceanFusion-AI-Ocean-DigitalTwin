import csv
from pathlib import Path


REGISTRY_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "metadata" / "source_registry.csv"
)


def load_source_registry():
    with REGISTRY_PATH.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))

