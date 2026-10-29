# Hora a hora · Reto 05

Aplicación web académica para simular el salario de una quincena. Permite crear empleados, registrar jornadas y descansos, marcar festivos, versionar recargos, calcular el neto y exportar el mismo resultado guardado a CSV.

## Abrir la aplicación

Requiere Python 3.11 o superior, [uv](https://docs.astral.sh/uv/) y Node.js 22.12 o superior con npm. Desde la carpeta del proyecto:

```bash
bash iniciar.sh
```

Abre [http://127.0.0.1:8019](http://127.0.0.1:8019). El script instala las dependencias bloqueadas, compila React y mantiene FastAPI en primer plano. `Ctrl+C` lo detiene. Si ese puerto está ocupado por una ejecución anterior, detén esa ejecución antes de iniciar otra.

1. Crea un empleado con su valor de hora ordinaria en COP.
2. Selecciona las fechas del período, inclusivas, entre 1 y 31 días.
3. Guarda las jornadas con fecha y hora de ingreso y salida. Si hay descanso sin pago, registra sus dos extremos.
4. En **Calendario y recargos**, marca los festivos y revisa los porcentajes aplicables.
5. Pulsa **Calcular período**. Consulta el desglose diario, exporta CSV o abre un resultado anterior en **Liquidaciones guardadas**.

## Reglas académicas

| Tema | Comportamiento |
|---|---|
| Tarifa | Positiva, hasta $1.000.000.000 por hora, con hasta dos decimales. |
| Diurnas | Horas de 06:00 a 19:00 en días sin marcar como festivos. |
| Nocturnas | Horas de 19:00 a 06:00. El inicio a las 19:00 viene del PDF; el final a las 06:00 es un supuesto explícito de esta aplicación. |
| Festivas | Todas las horas de un día marcado como festivo. Tienen prioridad; no se suma recargo nocturno a la misma hora. |
| Festivos y domingos | Se marcan manualmente en el calendario. No se calcula un calendario legal ni se asigna recargo dominical automáticamente. |
| Recargos | Inicialmente 35 % nocturno y 75 % festivo, ejemplos del PDF. Se admiten versiones por fecha de vigencia, entre 0 % y 1.000 %. |
| Descuento | 8 % del bruto, fijo para este ejercicio. |
| Descanso | Un intervalo explícito sin pago por jornada; se resta de las categorías que realmente atraviesa. |
| Cruces de fecha | La jornada se divide al llegar a las 00:00, 06:00, 19:00 y al descanso. El período recorta las horas externas a sus fechas. |
| Validación | Fechas entre 1900 y 2100, precisión de minutos, jornada de duración positiva y máximo 24 h. Se rechazan jornadas superpuestas del mismo empleado. |
| Dinero | Python `Decimal`, redondeo comercial a centavos por día y categoría. El bruto suma esos pagos; después se redondea el descuento. Las horas conservan precisión en el cálculo. |

El pago de cada categoría es `horas × valor_hora × (1 + recargo)`; en las diurnas el recargo es cero. `neto = bruto − bruto × 0,08`.

No se calcula un concepto separado de horas extras: el título del PDF lo menciona, pero sus fórmulas no definen cuándo nacen ni su recargo. Este simulador usa las tres categorías excluyentes del ejercicio y no sustituye un sistema de nómina laboral.

## Arquitectura y orientación del código

```text
frontend/
  src/
    components/    Formularios, campos, calendario y resumen visual
    pages/         Coordinación del estado y flujo de la pantalla
    services/      Cliente HTTP, tipos y exportación CSV
backend/
  main.py          Arranque de FastAPI y frontend compilado
  database.py      SQLite, seis tablas y conexión por petición
  models/          Contratos de entrada y validaciones
  routers/         Endpoints de registros y liquidaciones
  services/
    calculadora.py Operaciones monetarias del ejercicio
    clasificador.py División del tiempo por fecha y categoría
    festivos.py    Calendario con días marcados manualmente
  tests/           Comportamientos del motor y de la API
```

React + TypeScript + Tailwind se comunican por HTTP/JSON con Python + FastAPI. SQLite mantiene seis tablas relacionadas:

| Tabla | Responsabilidad y relación |
|---|---|
| `employees` | Empleado y tarifa ordinaria. |
| `calendar_days` | Fecha, marca de festivo y nombre. |
| `shifts` | Jornadas y descanso; referencia a empleado. |
| `surcharge_rules` | Versiones inmutables de recargos con fecha de inicio única. |
| `settlements` | Período, tarifa, horas y totales calculados; referencia a empleado. |
| `settlement_details` | Fecha, categoría, horas, factor y pago; referencias a liquidación, día y versión de regla. |

Las liquidaciones guardan sus valores calculados. Cambiar un festivo, agregar una versión de recargos o eliminar una jornada no altera una liquidación anterior. Para ver esos cambios se calcula una nueva. La interfaz muestra hasta 100 resultados recientes por empleado; los anteriores siguen disponibles por su identificador en la API.

Los comentarios breves en español señalan la responsabilidad de las capas y las decisiones del cálculo.

## API

Documentación interactiva: [http://127.0.0.1:8019/docs](http://127.0.0.1:8019/docs). Los endpoints también están disponibles con prefijo `/api` para el frontend compilado.

| Método | Ruta | Uso |
|---|---|---|
| GET / POST | `/empleados` | Consultar o crear empleados. |
| GET | `/calendario?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | Ver fechas y marcas de festivo. |
| POST | `/calendario` | Crear o actualizar la marca de una fecha. |
| GET / POST | `/jornadas` | Consultar por `empleado_id` o registrar una jornada. |
| DELETE | `/jornadas/{id}` | Eliminar una jornada para corregirla. |
| GET / POST | `/recargos` | Consultar versiones o crear una con nueva fecha de vigencia. |
| POST | `/liquidaciones/calcular` | Calcular y guardar un período por empleado. |
| GET | `/liquidaciones?empleado_id=1` | Consultar resultados recientes. |
| GET | `/liquidaciones/{id}` | Recuperar un resultado guardado con su detalle. |

## Desarrollo y verificación

Para editar con recarga del frontend, usa dos terminales:

```bash
uv run uvicorn backend.main:app --host 127.0.0.1 --port 8019 --reload
```

```bash
npm --prefix frontend run dev
```

Abre [http://127.0.0.1:5179](http://127.0.0.1:5179). Vite envía `/api` al backend mediante su proxy.

```bash
uv run pytest -q
uv run ruff check backend
uv run ruff format --check backend
npm --prefix frontend run format:check
npm --prefix frontend run build
bash -n iniciar.sh
```

Las pruebas verifican el ejemplo del PDF (60 h diurnas, 20 h nocturnas y 8 h festivas a $8.000: neto $743.360), entradas inválidas, cruces de mes y año, descansos, recorte de períodos, versiones de reglas, resultados guardados, solapamientos y peticiones paralelas del navegador.

Los datos están en `data/simulador.sqlite3`, excluidos de Git junto con entornos y compilaciones. `SIMULATOR_DATABASE` permite elegir otro archivo. La aplicación funciona en este equipo, ligada a `127.0.0.1`; no incorpora autenticación ni despliegue público.
