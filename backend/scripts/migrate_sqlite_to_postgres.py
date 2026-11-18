"""Copy the local OceanFusion SQLite database into an empty PostgreSQL DB.

Set DATABASE_URL to the destination PostgreSQL connection string before use.
The script refuses to overwrite any non-empty destination tables.
"""

from __future__ import annotations

import os
from pathlib import Path
import sys

from sqlalchemy import create_engine, func, inspect, select, text


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT / "data" / "oceanfusion.sqlite"
BATCH_SIZE = 5000


def main() -> int:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
        raise SystemExit("DATABASE_URL must point to the destination PostgreSQL database.")

    source_path = Path(os.getenv("OCEANFUSION_SQLITE_PATH", str(DEFAULT_SOURCE)))
    if not source_path.is_file():
        raise SystemExit(f"SQLite source database was not found: {source_path}")

    sys.path.insert(0, str(ROOT / "backend"))
    from app import create_app, db

    app = create_app({"SQLALCHEMY_DATABASE_URI": database_url, "TESTING": True})
    source_engine = create_engine(f"sqlite:///{source_path.as_posix()}")

    with app.app_context():
        tables = db.metadata.sorted_tables
        with db.engine.connect() as destination:
            occupied = [
                table.name
                for table in tables
                if destination.execute(
                    select(func.count()).select_from(table)
                ).scalar_one()
            ]
        if occupied:
            raise SystemExit(
                "Destination database is not empty; no data was changed. "
                "Tables with records: " + ", ".join(occupied)
            )

        source_table_names = set(inspect(source_engine).get_table_names())
        with source_engine.connect() as source:
            missing = [
                table.name
                for table in tables
                if table.name not in source_table_names
            ]
            if missing:
                raise SystemExit(
                    "SQLite database is missing expected tables: " + ", ".join(missing)
                )

            for table in tables:
                copied = 0
                with source_engine.connect() as source_connection, db.engine.begin() as destination:
                    result = source_connection.execution_options(stream_results=True).execute(
                        select(table)
                    )
                    while batch := result.fetchmany(BATCH_SIZE):
                        destination.execute(
                            table.insert(),
                            [dict(row._mapping) for row in batch],
                        )
                        copied += len(batch)
                print(f"{table.name}: copied {copied:,} rows", flush=True)

                primary_key = list(table.primary_key.columns)
                if len(primary_key) == 1 and primary_key[0].name == "id":
                    with db.engine.begin() as destination:
                        sequence = destination.execute(
                            text("SELECT pg_get_serial_sequence(:table_name, 'id')"),
                            {"table_name": table.name},
                        ).scalar_one_or_none()
                        if sequence:
                            max_id = destination.execute(
                                select(func.max(primary_key[0]))
                            ).scalar_one()
                            if max_id is not None:
                                destination.execute(
                                    text("SELECT setval(CAST(:sequence_name AS regclass), :max_id, true)"),
                                    {"sequence_name": sequence, "max_id": max_id},
                                )

                with db.engine.connect() as destination:
                    destination_count = destination.execute(
                        select(func.count()).select_from(table)
                    ).scalar_one()
                if destination_count != copied:
                    raise RuntimeError(
                        f"Row count verification failed for {table.name}: "
                        f"copied {copied}, found {destination_count}"
                    )

    source_engine.dispose()
    print("Migration complete; PostgreSQL row counts match the SQLite source.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
