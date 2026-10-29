from decimal import Decimal

import pytest

from backend.services.calculadora import calculate_pay


def test_pdf_worked_example():
    result = calculate_pay(
        Decimal("8000"),
        {"diurna": Decimal(60), "nocturna": Decimal(20), "festiva": Decimal(8)},
        Decimal("0.35"),
        Decimal("0.75"),
    )
    assert result == {
        "diurna": Decimal("480000.00"),
        "nocturna": Decimal("216000.00"),
        "festiva": Decimal("112000.00"),
        "bruto": Decimal("808000.00"),
        "descuento": Decimal("64640.00"),
        "neto": Decimal("743360.00"),
    }


@pytest.mark.parametrize(
    "rate,hours,night,holiday",
    [
        ("0", "1", "0.35", "0.75"),
        ("8000", "-1", "0.35", "0.75"),
        ("8000", "1", "-0.1", "0.75"),
        ("NaN", "1", "0.35", "0.75"),
        ("8000", "Infinity", "0.35", "0.75"),
    ],
)
def test_rejects_invalid_pay_inputs(rate, hours, night, holiday):
    with pytest.raises(ValueError):
        calculate_pay(
            Decimal(rate), {"diurna": Decimal(hours)}, Decimal(night), Decimal(holiday)
        )
