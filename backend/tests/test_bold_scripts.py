from pathlib import Path


def test_bold_scripts_are_present():
    root = Path(__file__).parents[1]

    assert (root / "scripts" / "download_bold_coi.py").exists()
    assert (root / "scripts" / "validate_bold_coi.py").exists()
