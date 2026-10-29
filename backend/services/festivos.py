from datetime import timedelta


def calendar_days(db, start, end):
    # El calendario académico usa festivos marcados por el usuario, sin asumir normativa.
    saved = {
        row["fecha"]: dict(row)
        for row in db.execute(
            "SELECT * FROM calendar_days WHERE fecha BETWEEN ? AND ?", (str(start), str(end))
        )
    }
    days = []
    current = start
    while current <= end:
        item = saved.get(
            str(current), {"fecha": str(current), "es_festivo": False, "nombre": ""}
        )
        item["es_festivo"] = bool(item["es_festivo"])
        days.append(item)
        current += timedelta(days=1)
    return days
