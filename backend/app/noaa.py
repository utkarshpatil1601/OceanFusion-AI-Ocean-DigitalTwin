from pathlib import Path
from datetime import datetime

import xarray as xr

from .models import Dataset, OceanObservation


DATA_DIR = Path(__file__).resolve().parents[2] / "data"
NOAA_DIR = DATA_DIR / "raw" / "noaa"


def _coordinate_name(dataset, candidates):
    for candidate in candidates:
        if candidate in dataset.coords:
            return candidate
    raise ValueError(f"NetCDF file is missing one of: {', '.join(candidates)}")


def ingest_noaa_files(session, files=None):
    files = sorted(files or NOAA_DIR.glob("*.nc"))
    if not files:
        raise FileNotFoundError(f"No NOAA NetCDF files found in {NOAA_DIR}")

    dataset = session.query(Dataset).filter_by(name="Daily Optimum Interpolation Sea Surface Temperature v2.1").first()
    if dataset is None:
        dataset = Dataset(
            name="Daily Optimum Interpolation Sea Surface Temperature v2.1",
            source="NOAA NCEI",
            description="Downloaded NOAA OISST v2.1 NetCDF files",
        )
        session.add(dataset)
        session.flush()

    inserted = 0
    for path in files:
        session.query(OceanObservation).filter_by(source_record_id=path.name).delete()
        with xr.open_dataset(path) as source:
            lat_name = _coordinate_name(source, ("lat", "latitude"))
            lon_name = _coordinate_name(source, ("lon", "longitude"))
            time_name = _coordinate_name(source, ("time",))
            if "sst" not in source:
                raise ValueError(f"{path.name} does not contain an sst variable")

            subset = source.sel(
                {lat_name: slice(5, 26), lon_name: slice(50, 78)}
            )
            sst = subset["sst"].squeeze(drop=True)
            anomaly = subset["anom"].squeeze(drop=True) if "anom" in subset else None
            timestamp = subset[time_name].values[0].astype("datetime64[ms]").astype(datetime)
            latitudes = subset[lat_name].values
            longitudes = subset[lon_name].values
            values = sst.values
            anomaly_values = anomaly.values if anomaly is not None else None
            if values.ndim == 3:
                values = values[0]
            if anomaly_values is not None and anomaly_values.ndim == 3:
                anomaly_values = anomaly_values[0]
            for lat_index, latitude in enumerate(latitudes):
                for lon_index, longitude in enumerate(longitudes):
                    value = float(values[lat_index, lon_index])
                    if value != value or value <= -900:
                        continue
                    anomaly_value = None
                    if anomaly_values is not None:
                        candidate = float(anomaly_values[lat_index, lon_index])
                        anomaly_value = None if candidate <= -900 or candidate != candidate else candidate
                    session.add(
                        OceanObservation(
                            dataset_id=dataset.id,
                            observation_time=timestamp,
                            latitude=float(latitude),
                            longitude=float(longitude),
                            sst=value,
                            sst_anomaly=anomaly_value,
                            source_record_id=path.name,
                        )
                    )
                    inserted += 1
    session.commit()
    return inserted
