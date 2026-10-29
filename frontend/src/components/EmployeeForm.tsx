import { useState } from "react";
import { api } from "../services/api";
import type { Employee } from "../services/api";
import { Field } from "./Field";

export function EmployeeForm({
  busy,
  onSave,
  run,
}: {
  busy: boolean;
  onSave: (employee: Employee) => void;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [rate, setRate] = useState("8000");
  return (
    <form
      className="employee-form"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const employee = await api.createEmployee({
            nombre: name.trim(),
            valor_hora: rate,
          });
          onSave(employee);
          setName("");
        });
      }}
    >
      <Field label="Nombre del empleado">
        <input
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Ana Pérez"
        />
      </Field>
      <Field label="Valor de la hora (COP)">
        <input
          required
          type="number"
          min="0.01"
          max="1000000000"
          step="0.01"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
        />
      </Field>
      <button className="button primary" disabled={busy || !name.trim()}>
        Crear empleado
      </button>
    </form>
  );
}
