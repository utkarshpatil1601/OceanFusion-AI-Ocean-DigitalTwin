import click
from flask import current_app

from . import db
from .models import Dataset
from .source_registry import load_source_registry
from .noaa import ingest_noaa_files
from .obis import ingest_obis_file
from .worms import normalize_bold_taxonomy, normalize_obis_taxonomy
from .ncbi import retrieve_ncbi_sequences
from .bold import ingest_bold_sequences
from .cmfri import ingest_cmfri
from .ocean_summary_cache import clear_daily_summary_cache


def register_cli(app):
    @app.cli.command("seed-datasets")
    def seed_datasets():
        """Register planned external data sources in the database."""
        existing = {row.name for row in db.session.query(Dataset).all()}
        created = 0
        for source in load_source_registry():
            if source["name"] in existing:
                continue
            db.session.add(
                Dataset(
                    name=source["name"],
                    source=source["provider"],
                    description=(
                        f'{source["format"]}; scope: {source["spatial_scope"]}; '
                        f'status: {source["status"]}'
                    ),
                )
            )
            created += 1
        db.session.commit()
        click.echo(f"Registered {created} dataset sources.")

    @app.cli.command("ingest-noaa")
    def ingest_noaa():
        """Ingest downloaded NOAA OISST NetCDF files into the database."""
        inserted = ingest_noaa_files(db.session)
        clear_daily_summary_cache()
        click.echo(f"Inserted {inserted} NOAA observations.")

    @app.cli.command("ingest-obis")
    def ingest_obis():
        """Ingest the acquired OBIS response into the database."""
        inserted, skipped = ingest_obis_file(db.session)
        click.echo(f"Inserted {inserted} OBIS occurrences; skipped {skipped}.")

    @app.cli.command("normalize-worms")
    def normalize_worms():
        """Resolve distinct OBIS names against the WoRMS REST API."""
        resolved, unresolved, total = normalize_obis_taxonomy(db.session)
        click.echo(
            f"Processed {total} names; resolved {resolved}; unresolved {unresolved}."
        )

    @app.cli.command("normalize-bold-worms")
    @click.option("--limit", default=100, show_default=True, type=int)
    @click.option("--pause", default=0.1, show_default=True, type=float)
    def normalize_bold_worms(limit, pause):
        """Resolve a bounded cached batch of BOLD names through WoRMS."""
        resolved, unresolved, cached, total = normalize_bold_taxonomy(
            db.session, limit=max(limit, 1), pause_seconds=max(pause, 0)
        )
        click.echo(
            f"Processed {total} BOLD names; resolved {resolved}; "
            f"unresolved {unresolved}; cached {cached}."
        )

    @app.cli.command("retrieve-ncbi")
    def retrieve_ncbi():
        """Retrieve and validate FASTA records from the saved NCBI search."""
        valid, invalid, requested = retrieve_ncbi_sequences(db.session)
        click.echo(
            f"Requested {requested} NCBI IDs; valid {valid}; invalid {invalid}."
        )

    @app.cli.command("ingest-bold")
    def ingest_bold():
        """Ingest the acquired BOLD India COI-5P export."""
        inserted, updated, invalid, skipped = ingest_bold_sequences(db.session)
        click.echo(
            f"Inserted {inserted} BOLD sequences; updated {updated}; "
            f"invalid {invalid}; skipped {skipped}."
        )

    @app.cli.command("ingest-cmfri")
    def ingest_cmfri_command():
        """Ingest real CMFRI statewise and covered resource-wise landings."""
        inserted, updated = ingest_cmfri(db.session)
        click.echo(f"Inserted {inserted} CMFRI landings; updated {updated}.")
