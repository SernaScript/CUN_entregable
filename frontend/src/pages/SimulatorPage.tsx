import { useEffect, useState } from "react";
import { EmployeeForm } from "../components/EmployeeForm";
import { Field } from "../components/Field";
import { ResultPanel } from "../components/ResultPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { ShiftForm } from "../components/ShiftForm";
import { api } from "../services/api";
import type {
  CalendarDay,
  Employee,
  HistoryItem,
  Rule,
  Settlement,
  Shift,
} from "../services/api";
import {
  currency,
  currentFortnight,
  dateLabel,
  timeLabel,
} from "../services/format";

const initialPeriod = currentFortnight();

export function SimulatorPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState(0);
  const [start, setStart] = useState(initialPeriod.start);
  const [end, setEnd] = useState(initialPeriod.end);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [result, setResult] = useState<Settlement | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const employee = employees.find((item) => item.id === employeeId);
  const daySpan = (Date.parse(end) - Date.parse(start)) / 86400000;
  const validPeriod =
    start >= "1900-01-01" &&
    end <= "2100-12-31" &&
    daySpan >= 0 &&
    daySpan < 31;
  const visibleShifts = shifts.filter(
    (shift) => shift.inicio.slice(0, 10) <= end && shift.fin > `${start}T00:00`,
  );

  // La página coordina el estado; los formularios y el resumen se mantienen separados.
  useEffect(() => {
    let active = true;
    void Promise.all([api.employees(), api.rules()])
      .then(([people, versions]) => {
        if (active) {
          setEmployees(people);
          setRules(versions);
          setEmployeeId(people[0]?.id ?? 0);
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setShifts([]);
    setHistory([]);
    if (employeeId)
      void Promise.all([api.shifts(employeeId), api.history(employeeId)])
        .then(([rows, saved]) => {
          if (active) {
            setShifts(rows);
            setHistory(saved);
          }
        })
        .catch((error) => {
          if (active) setError(error.message);
        });
    return () => {
      active = false;
    };
  }, [employeeId]);

  useEffect(() => {
    let active = true;
    setCalendar([]);
    if (validPeriod)
      void api
        .calendar(start, end)
        .then((days) => {
          if (active) setCalendar(days);
        })
        .catch((error) => {
          if (active) setError(error.message);
        });
    return () => {
      active = false;
    };
  }, [start, end, validPeriod]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo completar la operación.",
      );
    } finally {
      setBusy(false);
    }
  }
  function invalidate() {
    setResult(null);
    setNotice(
      "Datos actualizados. Calcula el período para generar un nuevo resultado.",
    );
  }
  async function refreshShifts() {
    setShifts(await api.shifts(employeeId));
    invalidate();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#main">
          <span>h.</span>
          <div>
            Hora a hora<small>Simulador quincenal</small>
          </div>
        </a>
        <nav aria-label="Secciones">
          <a href="#period" className="nav-item">
            <span>01</span>Empleado y período
          </a>
          <a href="#shifts" className="nav-item">
            <span>02</span>Jornadas
          </a>
          <a href="#settings" className="nav-item">
            <span>03</span>Calendario y reglas
          </a>
        </nav>
        <div className="sidebar-note">
          <p className="eyebrow">Reto 05</p>
          <strong>Fundamentos de programación</strong>
          <p>
            De las horas registradas al salario neto, con cada operación a la
            vista.
          </p>
          <span className="local-status">
            <i />
            Guardado local en SQLite
          </span>
        </div>
      </aside>
      <main id="main">
        <header className="page-header">
          <div>
            <p className="eyebrow">Laboratorio de programación · Reto 05</p>
            <h1>Simulador de salario</h1>
            <p>Registra jornadas. Revisa recargos. Entiende tu quincena.</p>
          </div>
          <span className="header-badge">Ejercicio académico</span>
        </header>
        <div className="academic-note">
          <span aria-hidden="true">i</span>
          <p>
            Recargos de ejemplo y descuento fijo del <strong>8 %</strong>. Los
            resultados representan las reglas de este ejercicio.
          </p>
        </div>
        {error && (
          <div className="message error" role="alert">
            <strong>No se pudo completar la operación.</strong>
            <span>{error}</span>
            <button type="button" onClick={() => window.location.reload()}>
              Recargar datos
            </button>
          </div>
        )}
        {notice && (
          <p className="message success" role="status">
            {notice}
          </p>
        )}
        {loading ? (
          <section className="panel loading" role="status">
            Cargando empleados y reglas…
          </section>
        ) : (
          <>
            <section
              className="panel period-panel"
              id="period"
              aria-labelledby="period-title"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">01 / Prepara el cálculo</p>
                  <h2 id="period-title">Empleado y período</h2>
                </div>
                <span className="tag">COP · Hora local</span>
              </div>
              <div className="form-grid period-grid">
                <Field label="Empleado">
                  <select
                    value={employeeId}
                    disabled={busy || !employees.length}
                    onChange={(event) => {
                      setEmployeeId(Number(event.target.value));
                      setResult(null);
                    }}
                  >
                    <option value={0}>Selecciona un empleado</option>
                    {employees.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Desde">
                  <input
                    type="date"
                    required
                    min="1900-01-01"
                    max="2100-12-31"
                    disabled={busy}
                    value={start}
                    onChange={(event) => {
                      setStart(event.target.value);
                      setResult(null);
                    }}
                  />
                </Field>
                <Field label="Hasta">
                  <input
                    type="date"
                    required
                    min="1900-01-01"
                    max="2100-12-31"
                    disabled={busy}
                    value={end}
                    onChange={(event) => {
                      setEnd(event.target.value);
                      setResult(null);
                    }}
                  />
                </Field>
              </div>
              {!validPeriod && (
                <p className="inline-error">
                  Elige entre 1 y 31 días consecutivos, de 1900 a 2100.
                </p>
              )}
              {employee && (
                <p className="selected-rate">
                  Valor de la hora ordinaria{" "}
                  <b>{currency(employee.valor_hora)}</b>
                </p>
              )}
              <details
                className="new-employee"
                open={employees.length === 0 || undefined}
              >
                <summary>
                  + Crear empleado{" "}
                  {employees.length === 0 && <span>Empieza aquí</span>}
                </summary>
                <EmployeeForm
                  busy={busy}
                  run={run}
                  onSave={(person) => {
                    setEmployees((previous) => [...previous, person]);
                    setEmployeeId(person.id);
                    setResult(null);
                    setNotice("Empleado creado. Registra su primera jornada.");
                  }}
                />
              </details>
            </section>
            <div className="workspace-grid">
              <div className="entry-column">
                <section
                  className="panel"
                  id="shifts"
                  aria-labelledby="shift-title"
                >
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">02 / Registra el tiempo</p>
                      <h2 id="shift-title">Jornadas de trabajo</h2>
                    </div>
                    <span className="count-badge">{visibleShifts.length}</span>
                  </div>
                  {!employeeId ? (
                    <p className="empty-note">
                      Crea o selecciona un empleado para registrar sus horas.
                    </p>
                  ) : (
                    <>
                      <ShiftForm
                        employeeId={employeeId}
                        day={start}
                        busy={busy}
                        onSave={refreshShifts}
                        run={run}
                      />
                      <div className="shift-list">
                        <h3>Jornadas del período</h3>
                        {visibleShifts.length === 0 && (
                          <p className="empty-note">
                            Todavía no hay jornadas en este período. Completa el
                            ingreso y la salida para agregar una.
                          </p>
                        )}
                        {visibleShifts.map((shift) => (
                          <article className="shift-row" key={shift.id}>
                            <div className="shift-icon" aria-hidden="true">
                              ↗
                            </div>
                            <div>
                              <strong>{timeLabel(shift.inicio)}</strong>
                              <span>hasta {timeLabel(shift.fin)}</span>
                              {shift.descanso_inicio && (
                                <small>
                                  Descanso: {timeLabel(shift.descanso_inicio)} →{" "}
                                  {timeLabel(shift.descanso_fin!)}
                                </small>
                              )}
                            </div>
                            <button
                              type="button"
                              className="delete-button"
                              aria-label={`Eliminar jornada del ${timeLabel(shift.inicio)}`}
                              disabled={busy}
                              onClick={() => {
                                void run(async () => {
                                  await api.deleteShift(shift.id);
                                  await refreshShifts();
                                });
                              }}
                            >
                              ×
                            </button>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="calculate-row">
                    <p>
                      El cálculo incluye solo las horas dentro del período
                      seleccionado.
                    </p>
                    <button
                      className="button primary"
                      disabled={busy || !employeeId || !validPeriod}
                      onClick={() => {
                        void run(async () => {
                          const saved = await api.calculate(
                            employeeId,
                            start,
                            end,
                          );
                          setResult(saved);
                          setHistory(await api.history(employeeId));
                          setNotice(
                            `Liquidación #${saved.id} calculada y guardada.`,
                          );
                        });
                      }}
                    >
                      {busy ? "Procesando…" : "Calcular período →"}
                    </button>
                  </div>
                </section>
                <div id="settings">
                  <SettingsPanel
                    days={calendar}
                    rules={rules}
                    start={start}
                    busy={busy}
                    run={run}
                    onDay={(day) => {
                      setCalendar((previous) =>
                        previous.map((item) =>
                          item.fecha === day.fecha ? day : item,
                        ),
                      );
                      invalidate();
                    }}
                    onRule={(rule) => {
                      setRules((previous) =>
                        [rule, ...previous].sort((a, b) =>
                          b.desde.localeCompare(a.desde),
                        ),
                      );
                      invalidate();
                    }}
                  />
                </div>
              </div>
              <div className="results-column">
                <ResultPanel result={result} />
                {history.length > 0 && (
                  <section className="panel history-panel">
                    <h2>Liquidaciones guardadas</h2>
                    <p className="muted">
                      Los resultados anteriores conservan los valores
                      calculados.
                    </p>
                    <Field label="Abrir una liquidación">
                      <select
                        value={result?.id ?? ""}
                        disabled={busy}
                        onChange={(event) => {
                          const id = Number(event.target.value);
                          if (id)
                            void run(async () => {
                              const saved = await api.settlement(id);
                              setStart(saved.desde);
                              setEnd(saved.hasta);
                              setResult(saved);
                            });
                        }}
                      >
                        <option value="">Selecciona un resultado</option>
                        {history.map((item) => (
                          <option key={item.id} value={item.id}>
                            #{item.id} · {dateLabel(item.desde)} —{" "}
                            {dateLabel(item.hasta)} · {currency(item.neto)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </section>
                )}
              </div>
            </div>
          </>
        )}
        <footer className="page-footer">
          <span>
            Reto 05 · Simulador de recargo nocturno y salario quincenal
          </span>
          <span>Datos almacenados en este equipo</span>
        </footer>
      </main>
    </div>
  );
}
