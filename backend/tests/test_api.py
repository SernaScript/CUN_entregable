from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app


def test_employee_can_be_created_and_retrieved(tmp_path):
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        created = client.post("/empleados", json={"nombre": "Ana Pérez", "valor_hora": "8000"})
        assert created.status_code == 201
        assert client.get("/empleados").json() == [created.json()]


def test_overnight_shift_break_and_holiday_are_classified_without_double_counting(tmp_path):
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        employee = client.post(
            "/empleados", json={"nombre": "Ana", "valor_hora": "8000"}
        ).json()
        holiday = client.post(
            "/calendario",
            json={"fecha": "2026-11-01", "es_festivo": True, "nombre": "Festivo de prueba"},
        )
        assert holiday.status_code == 200
        shift = client.post(
            "/jornadas",
            json={
                "empleado_id": employee["id"],
                "inicio": "2026-10-31T18:00",
                "fin": "2026-11-01T02:00",
                "descanso_inicio": "2026-10-31T19:00",
                "descanso_fin": "2026-10-31T20:00",
            },
        )
        assert shift.status_code == 201
        result = client.post(
            "/liquidaciones/calcular",
            json={"empleado_id": employee["id"], "desde": "2026-10-31", "hasta": "2026-11-01"},
        )
        assert result.status_code == 200
        data = result.json()
        assert data["horas"] == {"diurna": "1.0000", "nocturna": "4.0000", "festiva": "2.0000"}
        assert data["totales"] == {
            "bruto": "79200.00",
            "descuento": "6336.00",
            "neto": "72864.00",
        }
        assert [(row["fecha"], row["categoria"]) for row in data["detalle"]] == [
            ("2026-10-31", "diurna"),
            ("2026-10-31", "nocturna"),
            ("2026-11-01", "festiva"),
        ]


def test_rule_version_crosses_year_and_saved_result_does_not_change(tmp_path):
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        employee = client.post(
            "/empleados", json={"nombre": "Ana", "valor_hora": "8000"}
        ).json()
        rule = client.post(
            "/recargos",
            json={
                "desde": "2027-01-01",
                "nocturno": "0.5",
                "festivo": "0.8",
                "nombre": "Nueva simulación",
            },
        )
        assert rule.status_code == 201
        client.post(
            "/jornadas",
            json={
                "empleado_id": employee["id"],
                "inicio": "2026-12-31T18:00",
                "fin": "2027-01-01T08:00",
            },
        )
        result = client.post(
            "/liquidaciones/calcular",
            json={"empleado_id": employee["id"], "desde": "2026-12-31", "hasta": "2027-01-01"},
        ).json()
        assert result["totales"]["neto"] == "138000.00"
        assert len(client.get("/recargos").json()) == 2
        client.post("/calendario", json={"fecha": "2027-01-01", "es_festivo": True})
        assert client.get(f"/liquidaciones/{result['id']}").json() == result


def test_saved_periods_are_available_as_history(tmp_path):
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        employee = client.post(
            "/empleados", json={"nombre": "Ana", "valor_hora": "8000"}
        ).json()
        result = client.post(
            "/liquidaciones/calcular",
            json={"empleado_id": employee["id"], "desde": "2026-10-16", "hasta": "2026-10-31"},
        ).json()
        history = client.get("/liquidaciones", params={"empleado_id": employee["id"]})
        assert history.status_code == 200
        assert history.json() == [
            {"id": result["id"], "desde": "2026-10-16", "hasta": "2026-10-31", "neto": "0.00"}
        ]


def test_browser_prefix_exposes_same_api(tmp_path):
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        assert client.get("/api/empleados").json() == []


@pytest.mark.parametrize(
    "payload",
    [
        {"nombre": "Ana", "valor_hora": "NaN"},
        {"nombre": "Ana", "valor_hora": "Infinity"},
        {"nombre": "Ana", "valor_hora": "0"},
        {"nombre": "   ", "valor_hora": "8000"},
    ],
)
def test_employee_api_rejects_invalid_rates_and_names(tmp_path, payload):
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        assert client.post("/empleados", json=payload).status_code == 422


def test_overlap_is_rejected_and_deletion_allows_correction(tmp_path):
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        employee = client.post(
            "/empleados", json={"nombre": "Ana", "valor_hora": "8000"}
        ).json()
        payload = {
            "empleado_id": employee["id"],
            "inicio": "2026-10-28T08:00",
            "fin": "2026-10-28T16:00",
        }
        shift = client.post("/jornadas", json=payload).json()
        assert client.post("/jornadas", json=payload).status_code == 409
        assert client.delete(f"/jornadas/{shift['id']}").status_code == 204
        assert client.post("/jornadas", json=payload).status_code == 201


@pytest.mark.parametrize(
    "changes",
    [
        {"fin": "2026-10-28T08:00"},
        {"fin": "2026-10-30T09:00"},
        {"descanso_inicio": "2026-10-28T07:00", "descanso_fin": "2026-10-28T09:00"},
        {"descanso_inicio": "2026-10-28T12:00"},
        {"inicio": "2026-10-28T08:00:30"},
        {"inicio": "2026-10-28T08:00-05:00"},
    ],
)
def test_invalid_shift_intervals_are_rejected(tmp_path, changes):
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        payload = {
            "empleado_id": 1,
            "inicio": "2026-10-28T08:00",
            "fin": "2026-10-28T16:00",
            **changes,
        }
        assert client.post("/jornadas", json=payload).status_code == 422


def test_period_clips_shift_and_excludes_break_only_where_it_intersects(tmp_path):
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        employee = client.post(
            "/empleados", json={"nombre": "Ana", "valor_hora": "8000"}
        ).json()
        client.post(
            "/jornadas",
            json={
                "empleado_id": employee["id"],
                "inicio": "2026-10-31T18:00",
                "fin": "2026-11-01T08:00",
                "descanso_inicio": "2026-10-31T23:30",
                "descanso_fin": "2026-11-01T00:30",
            },
        )
        result = client.post(
            "/liquidaciones/calcular",
            json={"empleado_id": employee["id"], "desde": "2026-11-01", "hasta": "2026-11-01"},
        ).json()
        assert result["horas"] == {
            "diurna": "2.0000",
            "nocturna": "5.5000",
            "festiva": "0.0000",
        }
        assert result["totales"]["neto"] == "69368.00"


@pytest.mark.parametrize(
    "start,end", [("2026-11-02", "2026-11-01"), ("2026-10-01", "2026-11-01")]
)
def test_invalid_periods_are_rejected(tmp_path, start, end):
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        assert (
            client.get("/calendario", params={"desde": start, "hasta": end}).status_code == 422
        )


def test_parallel_browser_requests_can_read_independent_connections(tmp_path):
    with TestClient(
        create_app(tmp_path / "test.sqlite3"), raise_server_exceptions=False
    ) as client:
        paths = [
            "/api/empleados",
            "/api/recargos",
            "/api/calendario?desde=2026-10-16&hasta=2026-10-31",
        ] * 8
        with ThreadPoolExecutor(max_workers=8) as pool:
            statuses = list(pool.map(lambda path: client.get(path).status_code, paths))
        assert statuses == [200] * len(paths)
