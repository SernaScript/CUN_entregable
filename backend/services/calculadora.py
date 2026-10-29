from decimal import ROUND_HALF_UP, Decimal

CATEGORIES = ("diurna", "nocturna", "festiva")


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_pay(
    hourly_rate: Decimal,
    hours: dict[str, Decimal],
    night_surcharge: Decimal,
    holiday_surcharge: Decimal,
) -> dict[str, Decimal]:
    # El motor usa decimales; la presentación de moneda queda en el frontend.
    values = [hourly_rate, night_surcharge, holiday_surcharge, *hours.values()]
    if any(not value.is_finite() or value < 0 for value in values) or hourly_rate == 0:
        raise ValueError(
            "La tarifa debe ser positiva y los demás valores no negativos y finitos."
        )
    multipliers = {
        "diurna": Decimal(1),
        "nocturna": 1 + night_surcharge,
        "festiva": 1 + holiday_surcharge,
    }
    result = {
        kind: money(hours.get(kind, Decimal(0)) * hourly_rate * multipliers[kind])
        for kind in CATEGORIES
    }
    result["bruto"] = sum(result.values(), Decimal(0))
    result["descuento"] = money(result["bruto"] * Decimal("0.08"))
    result["neto"] = result["bruto"] - result["descuento"]
    return result
