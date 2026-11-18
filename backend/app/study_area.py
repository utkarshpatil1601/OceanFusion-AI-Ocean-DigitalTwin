from pathlib import Path
import json


STUDY_AREA_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "metadata" / "study_area.geojson"
)


def load_study_area():
    """Load the canonical study-area GeoJSON without changing its coordinates."""
    with STUDY_AREA_PATH.open(encoding="utf-8") as file:
        return json.load(file)

