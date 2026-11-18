from pathlib import Path

import pandas as pd
import pytest

from ml.fisheries.train import chronological_split, load_features


INPUT = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "raw"
    / "cmfri"
    / "CMFRI_Statewise_Landings_5_States_2013_2025.csv"
)


def test_cmfri_features_use_prior_year_only():
    frame = load_features(INPUT)
    assert len(frame) == 60
    assert frame["year"].min() == 2014
    first_kerala = frame[frame["state"] == "Kerala"].iloc[0]
    original = pd.read_csv(INPUT)
    expected = original[
        (original["state"] == "Kerala") & (original["year"] == 2013)
    ]["landings_tonnes"].iloc[0]
    assert first_kerala["previous_year_landings_tonnes"] == expected


def test_cmfri_split_is_chronological():
    train, test = chronological_split(load_features(INPUT), test_years=3)
    assert max(train["year"]) < min(test["year"])
    assert sorted(test["year"].unique()) == [2023, 2024, 2025]


def test_duplicate_year_state_is_rejected(tmp_path):
    duplicate = tmp_path / "duplicate.csv"
    pd.DataFrame(
        [
            {"year": 2013, "state": "Goa", "landings_tonnes": 1},
            {"year": 2013, "state": "Goa", "landings_tonnes": 2},
        ]
    ).to_csv(duplicate, index=False)
    with pytest.raises(ValueError, match="duplicate"):
        load_features(duplicate)
