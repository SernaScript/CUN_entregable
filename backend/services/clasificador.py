from collections import defaultdict
from datetime import datetime, time, timedelta
from decimal import Decimal


def classify_shifts(shifts, start, end, holidays):
    totals = defaultdict(Decimal)
    period_start = datetime.combine(start, time.min)
    period_end = datetime.combine(end + timedelta(days=1), time.min)
    for shift in shifts:
        left = max(datetime.fromisoformat(shift["inicio"]), period_start)
        right = min(datetime.fromisoformat(shift["fin"]), period_end)
        intervals = [(left, right)]
        if shift["descanso_inicio"]:
            break_start = datetime.fromisoformat(shift["descanso_inicio"])
            break_end = datetime.fromisoformat(shift["descanso_fin"])
            intervals = [(left, min(right, break_start)), (max(left, break_end), right)]
        for cursor, limit in intervals:
            while cursor < limit:
                day = cursor.date()
                boundaries = [datetime.combine(day + timedelta(days=1), time.min)]
                boundaries += [datetime.combine(day, time(hour)) for hour in (6, 19)]
                segment_end = min(limit, *(value for value in boundaries if value > cursor))
                # El festivo tiene precedencia: una hora pertenece a una sola categoría.
                category = (
                    "festiva"
                    if day.isoformat() in holidays
                    else ("nocturna" if cursor.hour >= 19 or cursor.hour < 6 else "diurna")
                )
                seconds = int((segment_end - cursor).total_seconds())
                totals[(day.isoformat(), category)] += Decimal(seconds) / Decimal(3600)
                cursor = segment_end
    return totals
