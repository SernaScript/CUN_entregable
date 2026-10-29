import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Field } from "./Field";

export function ShiftForm({
  employeeId,
  day,
  busy,
  onSave,
  run,
}: {
  employeeId: number;
  day: string;
  busy: boolean;
  onSave: () => Promise<void>;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [start, setStart] = useState(`${day}T08:00`);
  const [end, setEnd] = useState(`${day}T17:00`);
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStart, setBreakStart] = useState(`${day}T12:00`);
  const [breakEnd, setBreakEnd] = useState(`${day}T13:00`);
  useEffect(() => {
    setStart(`${day}T08:00`);
    setEnd(`${day}T17:00`);
    setBreakStart(`${day}T12:00`);
    setBreakEnd(`${day}T13:00`);
  }, [day]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await api.createShift({
            empleado_id: employeeId,
            inicio: start,
            fin: end,
            descanso_inicio: hasBreak ? breakStart : null,
            descanso_fin: hasBreak ? breakEnd : null,
          });
          await onSave();
        });
      }}
    >
      <div className="form-grid">
        <Field label="Ingreso">
          <input
            required
            type="datetime-local"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </Field>
        <Field label="Salida">
          <input
            required
            type="datetime-local"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </Field>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={hasBreak}
          onChange={(event) => setHasBreak(event.target.checked)}
        />{" "}
        Descontar un descanso sin pago
      </label>
      {hasBreak && (
        <div className="form-grid break-fields">
          <Field label="Inicio del descanso">
            <input
              required
              type="datetime-local"
              value={breakStart}
              onChange={(event) => setBreakStart(event.target.value)}
            />
          </Field>
          <Field label="Fin del descanso">
            <input
              required
              type="datetime-local"
              value={breakEnd}
              onChange={(event) => setBreakEnd(event.target.value)}
            />
          </Field>
        </div>
      )}
      <div className="form-footer">
        <small>
          Jornadas de hasta 24 h. Puedes registrar una salida al día siguiente.
        </small>
        <button
          className="button secondary"
          disabled={busy || !employeeId}
          type="submit"
        >
          + Guardar jornada
        </button>
      </div>
    </form>
  );
}
