import type { Settlement } from "../services/api";
import { currency, dateLabel, exportCsv, hours } from "../services/format";

export function ResultPanel({ result }: { result: Settlement | null }) {
  if (!result)
    return (
      <section className="panel result-empty" aria-label="Resultados">
        <div className="empty-symbol" aria-hidden="true">
          ∑
        </div>
        <p className="eyebrow">El resultado de tu trabajo</p>
        <h2>Tu quincena, desglosada</h2>
        <p>
          Selecciona un empleado, registra sus jornadas y calcula el período
          para ver cada hora y su valor.
        </p>
        <div className="empty-equation">
          <span>Horas × tarifa</span>
          <b>+</b>
          <span>Recargos</span>
          <b>−</b>
          <span>8 %</span>
        </div>
      </section>
    );
  const totalHours = Object.values(result.horas).reduce(
    (sum, value) => sum + Number(value),
    0,
  );
  return (
    <section className="panel result-panel" aria-labelledby="result-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Liquidación guardada · #{result.id}</p>
          <h2 id="result-title">Resumen del período</h2>
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={() => exportCsv(result)}
        >
          ↓ Exportar CSV
        </button>
      </div>
      <p className="muted">
        {result.empleado.nombre} · {dateLabel(result.desde)} al{" "}
        {dateLabel(result.hasta)}
      </p>
      <div className="net-total">
        <span>Salario neto simulado</span>
        <strong data-testid="net-total">{currency(result.totales.neto)}</strong>
        <small>Tarifa de {currency(result.empleado.valor_hora)} por hora</small>
      </div>
      <div className="hours-heading">
        <strong>Distribución de horas</strong>
        <span className="mono">{hours(totalHours)} h</span>
      </div>
      <div
        className="hours-band"
        role="img"
        aria-label={`Diurnas ${result.horas.diurna}, nocturnas ${result.horas.nocturna}, festivas ${result.horas.festiva} horas`}
      >
        {(["diurna", "nocturna", "festiva"] as const).map(
          (kind) =>
            Number(result.horas[kind]) > 0 && (
              <span
                key={kind}
                className={kind}
                style={{ flexGrow: Number(result.horas[kind]) }}
              />
            ),
        )}
      </div>
      <div className="hours-legend">
        {(["diurna", "nocturna", "festiva"] as const).map((kind) => (
          <div key={kind}>
            <span className={`dot ${kind}`} />
            <span>
              {kind === "diurna"
                ? "Diurnas"
                : kind === "nocturna"
                  ? "Nocturnas"
                  : "Festivas"}
            </span>
            <b>{hours(result.horas[kind])} h</b>
          </div>
        ))}
      </div>
      <dl className="totals">
        <div>
          <dt>Salario bruto</dt>
          <dd>{currency(result.totales.bruto)}</dd>
        </div>
        <div>
          <dt>Descuento del ejercicio · 8 %</dt>
          <dd>− {currency(result.totales.descuento)}</dd>
        </div>
        <div className="total-row">
          <dt>Salario neto</dt>
          <dd>{currency(result.totales.neto)}</dd>
        </div>
      </dl>
      <details className="breakdown" open>
        <summary>
          Desglose por día <span>{result.detalle.length} registros</span>
        </summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th className="numeric">Horas</th>
                <th className="numeric">Factor</th>
                <th className="numeric">Pago</th>
              </tr>
            </thead>
            <tbody>
              {result.detalle.map((row) => (
                <tr key={`${row.fecha}-${row.categoria}`}>
                  <td>{dateLabel(row.fecha)}</td>
                  <td>
                    <span className={`type-label ${row.categoria}`}>
                      {row.categoria}
                    </span>
                  </td>
                  <td className="numeric">{hours(row.horas)}</td>
                  <td className="numeric">×{row.multiplicador}</td>
                  <td className="numeric">{currency(row.pago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.detalle.length && (
            <p className="empty-note">
              No hay horas dentro de este período. El resultado es cero.
            </p>
          )}
        </div>
      </details>
      <p className="footnote">
        Cada pago se redondea a centavos por día y categoría. Las horas se
        muestran con hasta 2 decimales; el cálculo conserva su precisión.
      </p>
    </section>
  );
}
