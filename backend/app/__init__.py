import os
from pathlib import Path
from time import monotonic

from dotenv import load_dotenv
from flask import Flask, Response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text

db = SQLAlchemy()


def create_app(test_config=None):
    load_dotenv()
    app = Flask(__name__)
    app.extensions["oceanfusion_started_at"] = monotonic()
    default_database = (
        Path(__file__).resolve().parents[2] / "data" / "oceanfusion.sqlite"
    )
    database_url = os.getenv("DATABASE_URL")
    is_postgres = bool(
        database_url
        and database_url.startswith(("postgres://", "postgresql://", "postgresql+"))
    )
    app.config.from_mapping(
        SECRET_KEY=os.getenv("SECRET_KEY", "development-only"),
        SQLALCHEMY_DATABASE_URI=database_url or f"sqlite:///{default_database}",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS={
            "connect_args": (
                {"connect_timeout": 30} if is_postgres else {"timeout": 30.0}
            ),
        },
    )
    if test_config:
        app.config.update(test_config)
    configured_database_url = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if configured_database_url.startswith("postgres://"):
        app.config["SQLALCHEMY_DATABASE_URI"] = configured_database_url.replace(
            "postgres://", "postgresql+psycopg://", 1
        )
    elif configured_database_url.startswith("postgresql://"):
        app.config["SQLALCHEMY_DATABASE_URI"] = configured_database_url.replace(
            "postgresql://", "postgresql+psycopg://", 1
        )

    cors_origins = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if o.strip()
    ]
    CORS(app, origins=cors_origins)
    db.init_app(app)

    from .routes import api
    from .cli import register_cli

    with app.app_context():
        db.create_all()
        inspector = inspect(db.engine)
        inspector.clear_cache()
        columns = {
            column["name"]
            for column in inspector.get_columns("reference_sequences")
        }
        if "ecological_scope" not in columns:
            with db.engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE reference_sequences "
                        "ADD COLUMN ecological_scope VARCHAR(30) "
                        "DEFAULT 'unresolved' NOT NULL"
                    )
                )
        if "ecological_basis" not in columns:
            with db.engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE reference_sequences "
                        "ADD COLUMN ecological_basis VARCHAR(255)"
                    )
                )

    app.register_blueprint(api, url_prefix="/api")
    register_cli(app)

    @app.get("/metrics")
    def prometheus_metrics():
        """Expose lightweight Prometheus-compatible service health metrics."""
        database_up = 1
        try:
            db.session.execute(text("SELECT 1"))
        except Exception:
            db.session.rollback()
            database_up = 0

        uptime = max(0.0, monotonic() - app.extensions["oceanfusion_started_at"])
        body = "\n".join(
            [
                "# HELP oceanfusion_up Whether the OceanFusion API is serving requests.",
                "# TYPE oceanfusion_up gauge",
                "oceanfusion_up 1",
                "# HELP oceanfusion_database_up Whether the configured database is reachable.",
                "# TYPE oceanfusion_database_up gauge",
                f"oceanfusion_database_up {database_up}",
                "# HELP oceanfusion_process_uptime_seconds API process uptime in seconds.",
                "# TYPE oceanfusion_process_uptime_seconds gauge",
                f"oceanfusion_process_uptime_seconds {uptime:.3f}",
                "",
            ]
        )
        return Response(body, content_type="text/plain; version=0.0.4; charset=utf-8")

    return app
