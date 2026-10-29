from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator

Rate = Annotated[Decimal, Field(gt=0, le=1_000_000_000, max_digits=14, decimal_places=2)]
Surcharge = Annotated[Decimal, Field(ge=0, le=10, max_digits=7, decimal_places=4)]
AcademicDate = Annotated[date, Field(ge=date(1900, 1, 1), le=date(2100, 12, 31))]


class EmployeeCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100, pattern=r"\S")
    valor_hora: Rate


class CalendarDay(BaseModel):
    fecha: AcademicDate
    es_festivo: bool
    nombre: str = Field(default="", max_length=100)


class ShiftCreate(BaseModel):
    empleado_id: int = Field(gt=0)
    inicio: datetime
    fin: datetime
    descanso_inicio: datetime | None = None
    descanso_fin: datetime | None = None

    @field_validator("inicio", "fin", "descanso_inicio", "descanso_fin")
    @classmethod
    def local_minute(cls, value: datetime | None):
        if value is not None and (
            value.tzinfo or value.second or value.microsecond or not 1900 <= value.year <= 2100
        ):
            raise ValueError(
                "Usa fecha y hora local, entre 1900 y 2100, con precisión de minutos."
            )
        return value

    @model_validator(mode="after")
    def valid_interval(self):
        if not timedelta(0) < self.fin - self.inicio <= timedelta(days=1):
            raise ValueError(
                "La salida debe ser posterior al ingreso; máximo 24 horas por jornada."
            )
        if (self.descanso_inicio is None) != (self.descanso_fin is None):
            raise ValueError("Completa el inicio y el fin del descanso.")
        if self.descanso_inicio is not None and not (
            self.inicio <= self.descanso_inicio < self.descanso_fin <= self.fin
        ):
            raise ValueError(
                "El descanso debe estar dentro de la jornada y tener duración positiva."
            )
        return self


class RuleCreate(BaseModel):
    desde: AcademicDate
    nocturno: Surcharge
    festivo: Surcharge
    nombre: str = Field(min_length=1, max_length=100, pattern=r"\S")


class SettlementCreate(BaseModel):
    empleado_id: int = Field(gt=0)
    desde: AcademicDate
    hasta: AcademicDate

    @model_validator(mode="after")
    def valid_period(self):
        validate_period(self.desde, self.hasta)
        return self


def validate_period(start: date, end: date) -> None:
    if not 1900 <= start.year <= 2100 or not 1900 <= end.year <= 2100:
        raise ValueError("El año debe estar entre 1900 y 2100.")
    if not timedelta(0) <= end - start < timedelta(days=31):
        raise ValueError("El período debe tener entre 1 y 31 días, en orden cronológico.")
