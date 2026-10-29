import { useState } from "react";
import { api } from "../services/api";
import type { CalendarDay, Rule } from "../services/api";
import { dateLabel } from "../services/format";
import { Field } from "./Field";

export function SettingsPanel({
  days,
  rules,
  start,
  busy,
  onDay,
  onRule,
  run,
}: {
  days: CalendarDay[];
  rules: Rule[];
  start: string;
  busy: boolean;
  onDay: (day: CalendarDay) => void;
  onRule: (rule: Rule) => void;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [ruleStart, setRuleStart] = useState(start);
  const [night, setNight] = useState("35");
  const [holiday, setHoliday] = useState("75");
  return (
    <section className="panel settings-panel" aria-labelledby="settings-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Reglas de la simulación</p>
          <h2 id="settings-title">Calendario y recargos</h2>
        </div>
        <span className="tag">Configurables</span>
      </div>
      <details>
        <summary>
          Marcar días festivos del período{" "}
          <span>
            {days.filter((day) => day.es_festivo).length} seleccionados
          </span>
        </summary>
        <p className="muted">
          Selecciona los días que tratarás como festivos. No se cargan
          automáticamente; los domingos tampoco se marcan solos.
        </p>
        <div className="calendar-grid">
          {days.map((day) => (
            <button
              type="button"
              key={day.fecha}
              disabled={busy}
              aria-pressed={day.es_festivo}
              aria-label={`${dateLabel(day.fecha)} · ${day.es_festivo ? "Festivo" : "Normal"}`}
              className={`calendar-day ${day.es_festivo ? "selected" : ""}`}
              onClick={() => {
                void run(async () => {
                  const updated = await api.setDay({
                    ...day,
                    es_festivo: !day.es_festivo,
                    nombre: day.es_festivo ? "" : "Festivo marcado",
                  });
                  onDay(updated);
                });
              }}
            >
              <small>
                {new Date(`${day.fecha}T12:00:00`).toLocaleDateString("es-CO", {
                  weekday: "short",
                })}
              </small>
              <b>{day.fecha.slice(8)}</b>
              <small>{day.es_festivo ? "Festivo" : "Normal"}</small>
            </button>
          ))}
        </div>
        {!days.length && (
          <p className="empty-note">
            Selecciona un período válido de hasta 31 días para ver su
            calendario.
          </p>
        )}
      </details>
      <details>
        <summary>
          Versiones de recargos <span>{rules.length} versiones</span>
        </summary>
        <p className="muted">
          El cálculo toma la última versión vigente en cada fecha trabajada. Los
          porcentajes iniciales son ejemplos del PDF.
        </p>
        <ul className="rule-list">
          {rules.map((rule) => (
            <li key={rule.id}>
              <div>
                <strong>{rule.nombre}</strong>
                <small>
                  Desde {dateLabel(rule.desde)} · versión #{rule.id}
                </small>
              </div>
              <span>
                {Number(rule.nocturno) * 100} % noche
                <br />
                {Number(rule.festivo) * 100} % festivo
              </span>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const rule = await api.createRule({
                desde: ruleStart,
                nocturno: (Number(night) / 100).toFixed(4),
                festivo: (Number(holiday) / 100).toFixed(4),
                nombre: "Recargos de simulación",
              });
              onRule(rule);
            });
          }}
        >
          <div className="form-grid three">
            <Field label="Vigente desde">
              <input
                required
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                value={ruleStart}
                onChange={(event) => setRuleStart(event.target.value)}
              />
            </Field>
            <Field label="Recargo nocturno (%)">
              <input
                required
                type="number"
                min="0"
                max="1000"
                step="0.01"
                value={night}
                onChange={(event) => setNight(event.target.value)}
              />
            </Field>
            <Field label="Recargo festivo (%)">
              <input
                required
                type="number"
                min="0"
                max="1000"
                step="0.01"
                value={holiday}
                onChange={(event) => setHoliday(event.target.value)}
              />
            </Field>
          </div>
          <div className="form-footer">
            <small>Crear una versión conserva las anteriores.</small>
            <button disabled={busy} className="button secondary">
              Guardar nueva versión
            </button>
          </div>
        </form>
      </details>
      <p className="footnote">
        Supuestos del ejercicio: noche de 19:00 a 06:00; el festivo tiene
        prioridad y no acumula recargo nocturno. No se calculan horas extras
        porque el PDF no define su regla.
      </p>
    </section>
  );
}
