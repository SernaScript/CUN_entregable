import sqlite3
from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Request


def connect(path: Path) -> sqlite3.Connection:
    # FastAPI puede mover una petición entre hilos; la conexión sigue siendo por petición.
    connection = sqlite3.connect(path, timeout=10, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY, nombre TEXT NOT NULL,
                valor_hora TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS calendar_days (
                fecha TEXT PRIMARY KEY, es_festivo INTEGER NOT NULL DEFAULT 0,
                nombre TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS shifts (
                id INTEGER PRIMARY KEY, empleado_id INTEGER NOT NULL REFERENCES employees(id),
                inicio TEXT NOT NULL, fin TEXT NOT NULL,
                descanso_inicio TEXT, descanso_fin TEXT
            );
            CREATE INDEX IF NOT EXISTS shifts_employee_time ON shifts(empleado_id, inicio, fin);
            CREATE TABLE IF NOT EXISTS surcharge_rules (
                id INTEGER PRIMARY KEY, desde TEXT NOT NULL UNIQUE,
                nocturno TEXT NOT NULL, festivo TEXT NOT NULL, nombre TEXT NOT NULL
            );
            INSERT OR IGNORE INTO surcharge_rules(desde, nocturno, festivo, nombre)
                VALUES ('1900-01-01', '0.35', '0.75', 'Ejemplo académico del PDF');
            CREATE TABLE IF NOT EXISTS settlements (
                id INTEGER PRIMARY KEY, empleado_id INTEGER NOT NULL REFERENCES employees(id),
                desde TEXT NOT NULL, hasta TEXT NOT NULL, valor_hora TEXT NOT NULL,
                bruto TEXT NOT NULL, descuento TEXT NOT NULL,
                neto TEXT NOT NULL, horas TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settlement_details (
                id INTEGER PRIMARY KEY,
                liquidacion_id INTEGER NOT NULL REFERENCES settlements(id),
                fecha TEXT NOT NULL REFERENCES calendar_days(fecha),
                regla_id INTEGER NOT NULL REFERENCES surcharge_rules(id),
                categoria TEXT NOT NULL, horas TEXT NOT NULL, multiplicador TEXT NOT NULL,
                pago TEXT NOT NULL
            );
        """)


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    # Una conexión por petición mantiene las transacciones dentro de la API.
    db = connect(request.app.state.database_path)
    try:
        yield db
    finally:
        db.close()


DB = Annotated[sqlite3.Connection, Depends(get_db)]
