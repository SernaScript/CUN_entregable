import sqlite3
from datetime import date

from fastapi import APIRouter, HTTPException

from backend.database import DB
from backend.models import CalendarDay, EmployeeCreate, RuleCreate, ShiftCreate, validate_period
from backend.services.festivos import calendar_days

router = APIRouter()


@router.get("/empleados")
def list_employees(db: DB):
    return [dict(row) for row in db.execute("SELECT * FROM employees ORDER BY id")]


@router.post("/empleados", status_code=201)
def create_employee(data: EmployeeCreate, db: DB):
    with db:
        cursor = db.execute(
            "INSERT INTO employees(nombre, valor_hora) VALUES (?, ?)",
            (data.nombre.strip(), str(data.valor_hora)),
        )
    return dict(
        db.execute("SELECT * FROM employees WHERE id = ?", (cursor.lastrowid,)).fetchone()
    )


def require_employee(db, employee_id: int):
    employee = db.execute("SELECT * FROM employees WHERE id = ?", (employee_id,)).fetchone()
    if employee is None:
        raise HTTPException(404, "El empleado no existe.")
    return employee


@router.get("/calendario")
def list_calendar(desde: date, hasta: date, db: DB):
    validate_period(desde, hasta)
    return calendar_days(db, desde, hasta)


@router.post("/calendario")
def set_calendar_day(data: CalendarDay, db: DB):
    with db:
        db.execute(
            """INSERT INTO calendar_days(fecha, es_festivo, nombre) VALUES (?, ?, ?)
            ON CONFLICT(fecha) DO UPDATE SET es_festivo=excluded.es_festivo,
            nombre=excluded.nombre""",
            (str(data.fecha), data.es_festivo, data.nombre.strip()),
        )
    return data


@router.get("/jornadas")
def list_shifts(empleado_id: int, db: DB):
    require_employee(db, empleado_id)
    return [
        dict(row)
        for row in db.execute(
            "SELECT * FROM shifts WHERE empleado_id = ? ORDER BY inicio", (empleado_id,)
        )
    ]


@router.post("/jornadas", status_code=201)
def create_shift(data: ShiftCreate, db: DB):
    require_employee(db, data.empleado_id)
    values = data.model_dump()
    for key in ("inicio", "fin", "descanso_inicio", "descanso_fin"):
        values[key] = values[key].isoformat(timespec="minutes") if values[key] else None
    with db:
        # Reservar la escritura evita que dos peticiones creen jornadas superpuestas.
        db.execute("BEGIN IMMEDIATE")
        overlap = db.execute(
            """SELECT id FROM shifts
            WHERE empleado_id = ? AND inicio < ? AND fin > ?""",
            (data.empleado_id, values["fin"], values["inicio"]),
        ).fetchone()
        if overlap:
            raise HTTPException(409, "La jornada se superpone con otra del mismo empleado.")
        cursor = db.execute(
            """INSERT INTO shifts
            (empleado_id, inicio, fin, descanso_inicio, descanso_fin) VALUES (?, ?, ?, ?, ?)""",
            tuple(values.values()),
        )
    return dict(db.execute("SELECT * FROM shifts WHERE id = ?", (cursor.lastrowid,)).fetchone())


@router.delete("/jornadas/{shift_id}", status_code=204)
def delete_shift(shift_id: int, db: DB):
    with db:
        if not db.execute("DELETE FROM shifts WHERE id = ?", (shift_id,)).rowcount:
            raise HTTPException(404, "La jornada no existe.")


@router.get("/recargos")
def list_rules(db: DB):
    return [
        dict(row) for row in db.execute("SELECT * FROM surcharge_rules ORDER BY desde DESC")
    ]


@router.post("/recargos", status_code=201)
def create_rule(data: RuleCreate, db: DB):
    try:
        with db:
            cursor = db.execute(
                """INSERT INTO surcharge_rules(desde, nocturno, festivo, nombre)
                VALUES (?, ?, ?, ?)""",
                (str(data.desde), str(data.nocturno), str(data.festivo), data.nombre.strip()),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(
            409, "Ya existe una versión para esa fecha. Usa otra fecha de vigencia."
        )
    return dict(
        db.execute("SELECT * FROM surcharge_rules WHERE id = ?", (cursor.lastrowid,)).fetchone()
    )
