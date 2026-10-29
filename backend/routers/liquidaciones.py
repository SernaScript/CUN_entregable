import json
from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, HTTPException

from backend.database import DB
from backend.models import SettlementCreate
from backend.routers.registros import require_employee
from backend.services.calculadora import CATEGORIES, calculate_pay, money
from backend.services.clasificador import classify_shifts
from backend.services.festivos import calendar_days

router = APIRouter()


@router.get("/liquidaciones")
def list_settlements(empleado_id: int, db: DB):
    require_employee(db, empleado_id)
    return [
        dict(row)
        for row in db.execute(
            """SELECT id, desde, hasta, neto FROM settlements
        WHERE empleado_id = ? ORDER BY id DESC LIMIT 100""",
            (empleado_id,),
        )
    ]


@router.post("/liquidaciones/calcular")
def calculate_settlement(data: SettlementCreate, db: DB):
    employee = require_employee(db, data.empleado_id)
    rate = Decimal(employee["valor_hora"])
    with db:
        db.execute("BEGIN IMMEDIATE")
        days = calendar_days(db, data.desde, data.hasta)
        holidays = {day["fecha"] for day in days if day["es_festivo"]}
        shifts = db.execute("SELECT * FROM shifts WHERE empleado_id = ?", (data.empleado_id,))
        classified = classify_shifts(shifts, data.desde, data.hasta, holidays)
        details = []
        hours = defaultdict(Decimal)
        for day in days:
            rule = db.execute(
                "SELECT * FROM surcharge_rules WHERE desde <= ? ORDER BY desde DESC LIMIT 1",
                (day["fecha"],),
            ).fetchone()
            day_hours = {
                kind: classified.get((day["fecha"], kind), Decimal(0)) for kind in CATEGORIES
            }
            pay = calculate_pay(
                rate, day_hours, Decimal(rule["nocturno"]), Decimal(rule["festivo"])
            )
            for kind, quantity in day_hours.items():
                hours[kind] += quantity
                if quantity:
                    multiplier = Decimal(1) + Decimal(
                        rule["nocturno"]
                        if kind == "nocturna"
                        else rule["festivo"]
                        if kind == "festiva"
                        else "0"
                    )
                    details.append(
                        {
                            "fecha": day["fecha"],
                            "categoria": kind,
                            "horas": f"{quantity:.4f}",
                            "pago": str(pay[kind]),
                            "multiplicador": str(multiplier),
                            "regla_id": rule["id"],
                        }
                    )
            db.execute("INSERT OR IGNORE INTO calendar_days(fecha) VALUES (?)", (day["fecha"],))
        gross = sum((Decimal(row["pago"]) for row in details), Decimal(0))
        deduction = money(gross * Decimal("0.08"))
        totals = {
            "bruto": f"{gross:.2f}",
            "descuento": str(deduction),
            "neto": f"{gross - deduction:.2f}",
        }
        summary_hours = {kind: f"{hours[kind]:.4f}" for kind in CATEGORIES}
        cursor = db.execute(
            """INSERT INTO settlements
            (empleado_id, desde, hasta, valor_hora, bruto, descuento, neto, horas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data.empleado_id,
                str(data.desde),
                str(data.hasta),
                str(rate),
                *totals.values(),
                json.dumps(summary_hours),
            ),
        )
        settlement_id = cursor.lastrowid
        for row in details:
            db.execute(
                """INSERT INTO settlement_details
                (liquidacion_id, fecha, regla_id, categoria, horas, multiplicador, pago)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    settlement_id,
                    row["fecha"],
                    row["regla_id"],
                    row["categoria"],
                    row["horas"],
                    row["multiplicador"],
                    row["pago"],
                ),
            )
    return {
        "id": settlement_id,
        "empleado": dict(employee),
        "desde": str(data.desde),
        "hasta": str(data.hasta),
        "horas": summary_hours,
        "totales": totals,
        "detalle": details,
    }


@router.get("/liquidaciones/{settlement_id}")
def get_settlement(settlement_id: int, db: DB):
    saved = db.execute("SELECT * FROM settlements WHERE id = ?", (settlement_id,)).fetchone()
    if saved is None:
        raise HTTPException(404, "La liquidación no existe.")
    employee = dict(require_employee(db, saved["empleado_id"]))
    employee["valor_hora"] = saved["valor_hora"]
    details = [
        dict(row)
        for row in db.execute(
            """SELECT fecha, categoria, horas, pago,
        multiplicador, regla_id FROM settlement_details WHERE liquidacion_id = ? ORDER BY id""",
            (settlement_id,),
        )
    ]
    return {
        "id": saved["id"],
        "empleado": employee,
        "desde": saved["desde"],
        "hasta": saved["hasta"],
        "horas": json.loads(saved["horas"]),
        "totales": {key: saved[key] for key in ("bruto", "descuento", "neto")},
        "detalle": details,
    }
