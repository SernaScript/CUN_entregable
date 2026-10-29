export type Employee = { id: number; nombre: string; valor_hora: string };
export type Shift = {
  id: number;
  empleado_id: number;
  inicio: string;
  fin: string;
  descanso_inicio: string | null;
  descanso_fin: string | null;
};
export type CalendarDay = {
  fecha: string;
  es_festivo: boolean;
  nombre: string;
};
export type Rule = {
  id: number;
  desde: string;
  nocturno: string;
  festivo: string;
  nombre: string;
};
export type Category = "diurna" | "nocturna" | "festiva";
export type Settlement = {
  id: number;
  empleado: Employee;
  desde: string;
  hasta: string;
  horas: Record<Category, string>;
  totales: { bruto: string; descuento: string; neto: string };
  detalle: {
    fecha: string;
    categoria: Category;
    horas: string;
    multiplicador: string;
    pago: string;
    regla_id: number;
  }[];
};
export type HistoryItem = Pick<Settlement, "id" | "desde" | "hasta"> & {
  neto: string;
};

// Esta capa concentra HTTP; los componentes reciben datos y acciones con tipos.
async function request<T>(
  path: string,
  body?: unknown,
  method = "GET",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: body ? "POST" : method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor. Comprueba que esté iniciado.",
    );
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const detail = error?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail
              .map(
                (item: { loc: string[]; msg: string }) =>
                  `${item.loc.slice(1).join(" · ")}: ${item.msg}`,
              )
              .join(". ")
          : "No se pudo completar la operación. Vuelve a intentarlo.";
    throw new Error(message);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const api = {
  employees: () => request<Employee[]>("/empleados"),
  createEmployee: (data: { nombre: string; valor_hora: string }) =>
    request<Employee>("/empleados", data),
  shifts: (id: number) => request<Shift[]>(`/jornadas?empleado_id=${id}`),
  createShift: (data: Omit<Shift, "id">) => request<Shift>("/jornadas", data),
  deleteShift: (id: number) =>
    request<void>(`/jornadas/${id}`, undefined, "DELETE"),
  calendar: (start: string, end: string) =>
    request<CalendarDay[]>(`/calendario?desde=${start}&hasta=${end}`),
  setDay: (day: CalendarDay) => request<CalendarDay>("/calendario", day),
  rules: () => request<Rule[]>("/recargos"),
  createRule: (data: Omit<Rule, "id">) => request<Rule>("/recargos", data),
  calculate: (id: number, start: string, end: string) =>
    request<Settlement>("/liquidaciones/calcular", {
      empleado_id: id,
      desde: start,
      hasta: end,
    }),
  history: (id: number) =>
    request<HistoryItem[]>(`/liquidaciones?empleado_id=${id}`),
  settlement: (id: number) => request<Settlement>(`/liquidaciones/${id}`),
};
