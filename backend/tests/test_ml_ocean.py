import sqlite3
from pathlib import Path

import pandas as pd

from ml.ocean.train import FEATURE_COLUMNS, load_features


def test_noaa_features_are_loaded_from_processed_observations(tmp_path):
    database = tmp_path / "ocean.sqlite"
    with sqlite3.connect(database) as connection:
        pd.DataFrame(
            [
                (1, "2025-01-01 12:00:00", 10.0, 70.0, 26.0, 0.2),
                (2, "2025-01-02 12:00:00", 11.0, 71.0, 27.0, -0.1),
                (3, "2025-01-03 12:00:00", 12.0, 72.0, 28.0, None),
            ],
            columns=[
                "id", "observation_time", "latitude", "longitude", "sst",
                "sst_anomaly",
            ],
        ).to_sql("ocean_observations", connection, index=False)
    frame = load_features(database)
    assert len(frame) == 2
    assert FEATURE_COLUMNS == [
        "sst", "sst_anomaly", "latitude", "longitude", "day_of_year"
    ]
    assert frame["day_of_year"].tolist() == [1, 2]
