import type { Settlement } from "./api";

export const currency = (value: string | number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
export const hours = (value: string | number) =>
  new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
  }).format(Number(value));
export const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const timeLabel = (value: string) =>
  `${dateLabel(value.slice(0, 10))} · ${value.slice(11, 16)}`;

export function currentFortnight() {
  const now = new Date();
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const first = now.getDate() <= 15;
  return {
    start: iso(new Date(now.getFullYear(), now.getMonth(), first ? 1 : 16)),
    end: iso(
      new Date(
        now.getFullYear(),
        first ? now.getMonth() : now.getMonth() + 1,
        first ? 15 : 0,
      ),
    ),
  };
}

export function exportCsv(result: Settlement) {
  // Se exporta la misma liquidación guardada que se está mostrando en pantalla.
  const rows: (string | number)[][] = [
    ["Simulador académico Reto 05"],
    ["Liquidación", result.id],
    ["Empleado", result.empleado.nombre],
    ["Desde", result.desde],
    ["Hasta", result.hasta],
    ["Valor hora", result.empleado.valor_hora],
    [],
    [
      "Fecha",
      "Categoría",
      "Horas",
      "Multiplicador",
      "Pago COP",
      "Versión regla",
    ],
    ...result.detalle.map((row) => [
      row.fecha,
      row.categoria,
      row.horas,
      row.multiplicador,
      row.pago,
      row.regla_id,
    ]),
    [],
    ["Salario bruto COP", result.totales.bruto],
    ["Descuento 8% COP", result.totales.descuento],
    ["Salario neto COP", result.totales.neto],
  ];
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell);
          const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
          return `"${safe.replaceAll('"', '""')}"`;
        })
        .join(";"),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `liquidacion-${result.id}-${result.desde}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
