from datetime import date

from app.source_registry import load_source_registry
from app.study_area import load_study_area
from scripts.download_noaa_oisst import file_url, iter_dates


def test_source_registry_contains_noaa():
    sources = load_source_registry()

    assert any(source["dataset_key"] == "noaa_oisst_v2_1" for source in sources)


def test_study_area_is_geojson_polygon():
    study_area = load_study_area()

    assert study_area["type"] == "Feature"
    assert study_area["geometry"]["type"] == "Polygon"


def test_noaa_file_url_and_date_range():
    days = list(iter_dates(date(2025, 1, 1), date(2025, 1, 3)))

    assert len(days) == 3
    assert file_url(days[0]).endswith("/202501/oisst-avhrr-v02r01.20250101.nc")
