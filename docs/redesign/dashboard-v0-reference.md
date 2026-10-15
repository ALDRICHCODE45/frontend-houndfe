# Dashboard redesign — accepted v0 reference

Exported from the accepted v0 chat `https://v0.app/bdps-projects/chat/ps6ftjVkTIL` on
2026-10-15. This is a DESIGN PROPOSAL, not application code: it is committed verbatim so the
adaptation has one authoritative source for composition, geometry and motion.

Not adopted: the Next/React/framer-motion/recharts stack, the demo fixtures, the demo state
switcher, the demo theme toggle and the shadcn `components/ui` plumbing. The application keeps
its own queries, permissions, router, theme toggle and `@unovis/vue` charts.

See `odd/tasks/dashboard-visual.md` for the specs that govern the adaptation.

## `lib/dashboard-data.ts`

Demo data, labels and copy. Fixtures are NOT adopted; the copy and the metric order are.

```ts
export const labels = [
  "Ventas netas",
  "Ventas brutas",
  "Cobrado",
  "Deuda pendiente",
  "Cantidad de ventas",
  "Ticket promedio",
];
export const totals = [48920.5, 52310, 44180.5, 4740, 63, 776.52];
export const money = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    value,
  );
const net = [
  2350, 3120, 2840, 0, 4260, 3180, 4850, 2970, 3520, 0, 4680, 3910, 4250, 3870,
  5120.5,
];
const gross = [
  2550, 3320, 3040, 0, 4560, 3380, 5150, 3170, 3720, 0, 4980, 4110, 4550, 4070,
  5710,
];
const collected = [
  2150, 2820, 2540, 0, 3860, 2880, 4450, 2670, 3120, 0, 4180, 3610, 3750, 3470,
  4680.5,
];
const debt = [
  200, 300, 300, 0, 400, 300, 400, 300, 400, 0, 500, 300, 500, 400, 440,
];
const counts = [3, 4, 4, 0, 5, 4, 6, 4, 5, 0, 6, 5, 5, 5, 7];
const ticket = [
  783.33, 780, 710, 0, 852, 795, 808.33, 742.5, 704, 0, 780, 782, 850, 774,
  731.5,
];
export const daily = net.map((_, i) => ({
  date: `2026-10-${String(i + 1).padStart(2, "0")}`,
  values: [net[i], gross[i], collected[i], debt[i], counts[i], ticket[i]],
}));
export function rangeDays(from: string, to: string) {
  const days = [];
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  for (
    let d = start;
    d < end && days.length < 366;
    d = new Date(d.getTime() + 86400000)
  ) {
    const date = d.toISOString().slice(0, 10);
    days.push(
      daily.find((x) => x.date === date) ?? {
        date,
        values: [0, 0, 0, 0, 0, 0],
      },
    );
  }
  return days;
}
export const dateLabel = (date: string, full = false) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "short",
    ...(full ? { weekday: "short" as const, year: "numeric" as const } : {}),
  })
    .format(new Date(`${date}T12:00:00Z`))
    .replaceAll(".", "");
export type DemoState =
  | "ready"
  | "loading"
  | "refresh"
  | "stale"
  | "error"
  | "empty"
  | "denied"
  | "rejected";
export const stateOptions: [DemoState, string][] = [
  ["ready", "Normal"],
  ["loading", "Carga inicial"],
  ["refresh", "Actualizando"],
  ["stale", "Error al actualizar"],
  ["error", "Error de carga"],
  ["empty", "Sin actividad"],
  ["denied", "Sin permiso"],
  ["rejected", "Rango rechazado"],
];
export const panelInfo = [
  {
    title: "Ventas recientes",
    description: "Últimas ventas confirmadas de la sucursal.",
    empty: "No hay ventas confirmadas en el periodo.",
    error: "No pudimos cargar las ventas recientes.",
    loading: "Cargando las ventas recientes…",
  },
  {
    title: "Ventas con deuda",
    description: "Ventas confirmadas con saldo pendiente.",
    empty: "No hay ventas con deuda pendiente.",
    error: "No pudimos cargar las ventas con deuda.",
    loading: "Cargando las ventas con deuda…",
  },
  {
    title: "Reembolsos pendientes",
    description: "Reembolsos pendientes de liquidar.",
    empty: "No hay reembolsos pendientes.",
    error: "No pudimos cargar los reembolsos pendientes.",
    loading: "Cargando los reembolsos pendientes…",
  },
];
export const rows = [
  [
    ["Folio V-000231", "María Fernanda López", "15/10/2026 14:32", 1240],
    ["Folio V-000230", "Público en General", "15/10/2026 13:48", 685.5],
    ["Folio V-000229", "Comercializadora del Centro", "15/10/2026 12:16", 1890],
    ["Folio V-000228", "Público en General", "15/10/2026 11:05", 520],
    ["Folio V-000227", "Roberto Hernández", "15/10/2026 10:24", 785],
  ],
  [
    ["Folio V-000219", "Abarrotes La Esquina", "Vence 20/10/2026", 2150],
    ["Folio V-000214", "Carlos Mendoza", "Vence 22/10/2026", 1640],
    ["Folio V-000208", "Papelería Los Olivos", "Sin fecha de vencimiento", 950],
  ],
  [
    [
      "Venta 7f3c…",
      "Transferencia",
      "15/10/2026 12:40",
      1890,
      "Solicitud del cliente",
    ],
    [
      "Venta a8d2…",
      "Tarjeta de crédito",
      "14/10/2026 16:18",
      980,
      "Error en la venta",
    ],
    ["Venta b4e9…", "Efectivo", "13/10/2026 10:52", 519.5, "Sin existencias"],
  ],
] as const;
```

## `components/sales-dashboard.tsx`

Page composition: header, period controls, hero, metric grid, refunds band, panel grid, footer.

```tsx
"use client";
import { useRef, useState } from "react";
import { getDemoSummary } from "@/app/actions";
import { motion, MotionConfig } from "framer-motion";
import {
  CalendarDays,
  ChevronDown,
  Wallet,
  ReceiptText,
  Banknote,
  HandCoins,
  ShoppingBag,
  Ticket,
  RotateCcw,
  Clock3,
  Sun,
  Moon,
  SlidersHorizontal,
  X,
  Info,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Amount, Feedback, OperationalPanel } from "./dashboard-blocks";
import { SalesChart, Sparkline } from "./sales-chart";
import {
  rangeDays,
  labels,
  totals,
  dateLabel,
  stateOptions,
  type DemoState,
} from "@/lib/dashboard-data";
const icons = [Wallet, ReceiptText, Banknote, HandCoins, ShoppingBag, Ticket];
const presets = ["Hoy", "Últimos 7 días", "Este mes", "Mes anterior"];
const presetRanges = [
  ["2026-10-15", "2026-10-16"],
  ["2026-10-09", "2026-10-16"],
  ["2026-10-01", "2026-10-16"],
  ["2026-09-01", "2026-10-01"],
];
export default function SalesDashboard() {
  const [dark, setDark] = useState(false);
  const [preset, setPreset] = useState("Este mes");
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState("2026-10-16");
  const [displayRange, setDisplayRange] = useState([
    "2026-10-01",
    "2026-10-16",
  ]);
  const [values, setValues] = useState(totals);
  const [states, setStates] = useState<DemoState[]>([
    "ready",
    "ready",
    "ready",
    "ready",
    "ready",
  ]);
  const [demo, setDemo] = useState(false);
  const [panels, setPanels] = useState(3);
  const requestId = useRef(0);
  const daily = rangeDays(displayRange[0], displayRange[1]);
  const invalid =
    !from ||
    !to ||
    !(new Date(to).getTime() > new Date(from).getTime()) ||
    (new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 366;
  function updateState(i: number, state: DemoState) {
    setStates((s) => s.map((x, j) => (i === j ? state : x)));
  }
  async function refresh(start: string, end: string, selection: string) {
    const id = ++requestId.current;
    setFrom(start);
    setTo(end);
    setPreset(selection);
    const span =
      (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
    if (!(span > 0 && span <= 366)) return;
    setStates(Array(5).fill("refresh"));
    try {
      const [result] = await Promise.all([
        getDemoSummary(start, end),
        new Promise((resolve) => setTimeout(resolve, 450)),
      ]);
      if (id !== requestId.current) return;
      setDisplayRange([start, end]);
      setValues(result.values);
      setStates(Array(5).fill(result.empty ? "empty" : "ready"));
    } catch {
      if (id === requestId.current) setStates(Array(5).fill("stale"));
    }
  }
  function toggleTheme() {
    setDark(!dark);
    document.documentElement.classList.toggle("dark", !dark);
  }
  return (
    <MotionConfig reducedMotion="user">
      <main className="dashboard font-sans">
        <div className="dashboard-inner">
          <motion.header
            className="page-header"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="title-block">
              <div className="eyebrow">
                <span className="brand-marker" /> CONTROL DE VENTAS
              </div>
              <h1>Resumen de ventas</h1>
              <p>
                Ventas, cobros y reembolsos de la sucursal en el periodo
                seleccionado.
              </p>
            </div>
            <div className="period-controls">
              <div className="period-meta">
                <CalendarDays size={15} />
                <span>
                  {dateLabel(from || "2026-10-01")} –{" "}
                  {dateLabel(
                    new Date(
                      new Date(`${to || "2026-10-16"}T12:00:00Z`).getTime() -
                        86400000,
                    )
                      .toISOString()
                      .slice(0, 10),
                  )}{" "}
                  2026
                </span>
                <span className="period-dot" />
                Periodo seleccionado
              </div>
              <div className="period-actions">
                <div className="preset-scroll">
                  <ToggleGroup
                    value={preset ? [preset] : []}
                    onValueChange={(v) => {
                      if (v.length) {
                        const p = presets.indexOf(String(v[0]));
                        refresh(
                          presetRanges[p][0],
                          presetRanges[p][1],
                          presets[p],
                        );
                      }
                    }}
                    className="presets"
                    aria-label="Periodo de análisis"
                  >
                    {presets.map((p) => (
                      <ToggleGroupItem value={p} key={p} className="preset">
                        {preset === p && (
                          <motion.span
                            layoutId="period-selection"
                            className="preset-indicator"
                            transition={{
                              type: "spring",
                              bounce: 0,
                              duration: 0.25,
                            }}
                          />
                        )}
                        <span>{p}</span>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <Popover>
                  <PopoverTrigger
                    className="range-trigger"
                    aria-label="Personalizar periodo"
                  >
                    <CalendarDays size={17} />
                    <ChevronDown size={14} />
                  </PopoverTrigger>
                  <PopoverContent align="end" className="range-popover">
                    <PopoverTitle>Periodo de análisis</PopoverTitle>
                    <label>
                      Desde (incluyente)
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => refresh(e.target.value, to, "")}
                        aria-invalid={invalid}
                      />
                    </label>
                    <label>
                      Hasta (excluyente)
                      <input
                        type="date"
                        value={to}
                        onChange={(e) => refresh(from, e.target.value, "")}
                        aria-invalid={invalid}
                      />
                    </label>
                    <p>
                      El rango incluye el día «Desde» y excluye el día «Hasta».
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </motion.header>
          {invalid ? (
            <Alert variant="destructive">
              <Info />
              <AlertDescription>
                El rango no es válido: la fecha inicial debe ser anterior a la
                final y el periodo no puede superar 366 días.
                <br />
                Ajusta el periodo para volver a consultar el resumen de ventas.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="metrics-section"
              >
                <Feedback
                  state={states[0]}
                  retry={() => updateState(0, "ready")}
                >
                  <div className="hero panel">
                    <div className="hero-content">
                      <div className="metric-label">
                        <span className="hero-icon">
                          <Wallet size={20} />
                        </span>
                        <h2>Ventas netas</h2>
                      </div>
                      <div className="hero-value">
                        <Amount value={values[0]} />
                        <span>MXN</span>
                      </div>
                      <p>
                        Del {dateLabel(displayRange[0])} al{" "}
                        {dateLabel(
                          new Date(
                            new Date(`${displayRange[1]}T12:00:00Z`).getTime() -
                              86400000,
                          )
                            .toISOString()
                            .slice(0, 10),
                        )}{" "}
                        de 2026
                      </p>
                    </div>
                    <div className="hero-visual">
                      <Sparkline series={daily.map((d) => d.values[0])} hero />
                      <div className="spark-dates">
                        <span>{dateLabel(displayRange[0])}</span>
                        <span>{daily.length ? dateLabel(daily[daily.length - 1].date) : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div className="metric-grid">
                    {labels.slice(1).map((label, j) => {
                      const i = j + 1;
                      const Icon = icons[i];
                      return (
                        <motion.article
                          whileHover={{ y: -2 }}
                          className={`metric-card panel ${i === 3 ? "debt-card" : ""}`}
                          tabIndex={0}
                          key={label}
                        >
                          <div className="metric-label">
                            <Icon size={17} />
                            <h3>{label}</h3>
                            {i === 3 && <span className="warning-dot" />}
                          </div>
                          <div className="metric-value">
                            <Amount value={values[i]} count={i === 4} />
                          </div>
                          <Sparkline series={daily.map((d) => d.values[i])} />
                        </motion.article>
                      );
                    })}
                  </div>
                  <div className="refund-group">
                    <div className="refund-heading">
                      <RotateCcw size={17} />
                      <h2>Reembolsos</h2>
                      <span>Separados de las ventas del periodo</span>
                    </div>
                    <div className="refund-grid">
                      <div className="refund-item">
                        <span className="refund-icon">
                          <RotateCcw size={18} />
                        </span>
                        <span>Reembolsos liquidados</span>
                        <strong>
                          <Amount value={1240} />
                        </strong>
                      </div>
                      <div className="refund-item">
                        <span className="refund-icon warning">
                          <Clock3 size={18} />
                        </span>
                        <span>Obligaciones de reembolso pendientes</span>
                        <strong className="text-warning">
                          <Amount value={3389.5} />
                        </strong>
                      </div>
                    </div>
                  </div>
                </Feedback>
              </motion.section>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <SalesChart
                  from={displayRange[0]}
                  to={displayRange[1]}
                  state={states[1]}
                  retry={() => updateState(1, "ready")}
                />
              </motion.div>
              <motion.div
                className="operational-grid"
                data-panels={panels}
                style={{
                  gridTemplateColumns: `repeat(${panels || 1}, minmax(0, 1fr))`,
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                {Array.from({ length: panels }, (_, i) => (
                  <OperationalPanel
                    key={i}
                    index={i}
                    state={states[i + 2]}
                    retry={() => updateState(i + 2, "ready")}
                  />
                ))}
              </motion.div>
            </>
          )}
          <footer className="page-footer">
            <span>
              HoundFe<span className="footer-divider">/</span>Resumen de ventas
            </span>
            <span>Todos los importes en MXN · Hora de Ciudad de México</span>
          </footer>
        </div>
        <div className="demo-toolbar">
          <span className="demo-tag">Demo</span>
          <button
            onClick={toggleTheme}
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <span className="toolbar-divider" />
          <button onClick={() => setDemo(!demo)} aria-expanded={demo}>
            <SlidersHorizontal size={16} />
            Estados
            <ChevronDown size={13} />
          </button>
        </div>
        {demo && (
          <aside className="demo-panel panel">
            <header>
              <strong>Demo · Estados de vista</strong>
              <button onClick={() => setDemo(false)} aria-label="Cerrar demo">
                <X size={18} />
              </button>
            </header>
            <p>Datos ficticios para explorar el diseño.</p>
            <label>
              Todos los bloques
              <select
                onChange={(e) => setStates(Array(5).fill(e.target.value))}
                value={states.every((s) => s === states[0]) ? states[0] : ""}
              >
                <option value="" disabled>
                  Personalizado
                </option>
                {stateOptions.map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {[
              "Métricas",
              "Tendencia diaria",
              "Ventas recientes",
              "Ventas con deuda",
              "Reembolsos pendientes",
            ].map((label, i) => (
              <label key={label}>
                {label}
                <select
                  value={states[i]}
                  onChange={(e) => updateState(i, e.target.value as DemoState)}
                >
                  {stateOptions.map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Paneles con permiso
              <select
                value={panels}
                onChange={(e) => setPanels(Number(e.target.value))}
              >
                {[3, 2, 1, 0].map((n) => (
                  <option key={n} value={n}>
                    {n} paneles
                  </option>
                ))}
              </select>
            </label>
          </aside>
        )}
      </main>
    </MotionConfig>
  );
}
```

## `components/sales-chart.tsx`

Sparkline and the daily trend panel: metric tabs, gradient area, cursor, tooltip, keyboard, table toggle.

```tsx
"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table2, ChevronDown, ChartNoAxesCombined } from "lucide-react";
import {
  labels,
  money,
  dateLabel,
  type DemoState,
  rangeDays,
} from "@/lib/dashboard-data";
import { Feedback } from "./dashboard-blocks";
export function Sparkline({
  series,
  hero = false,
}: {
  series: number[];
  hero?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <ChartContainer
      config={{ value: { color: "var(--chart-1)" } }}
      className={hero ? "hero-spark" : "spark"}
    >
      <AreaChart
        accessibilityLayer={false}
        aria-hidden="true"
        data={series.map((value) => ({ value }))}
        margin={{ top: 5, bottom: 2, left: 0, right: 2 }}
      >
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={hero ? 2.5 : 1.6}
          fill="var(--color-value)"
          fillOpacity={hero ? 0.07 : 0}
          isAnimationActive={!reduced}
          animationDuration={500}
        />
      </AreaChart>
    </ChartContainer>
  );
}
export function SalesChart({
  from,
  to,
  state,
  retry,
}: {
  from: string;
  to: string;
  state: DemoState;
  retry: () => void;
}) {
  const [metric, setMetric] = useState(0);
  const [table, setTable] = useState(false);
  const [keyboard, setKeyboard] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const data = rangeDays(from, to).map((d) => ({
    date: d.date,
    value: d.values[metric],
  }));
  const format = (v: number) => (metric === 4 ? String(v) : money(v));
  return (
    <section className="panel trend">
      <header className="chart-heading">
        <div>
          <h2>Tendencia diaria</h2>
          <p>El comportamiento de tus ventas, día a día.</p>
        </div>
        <ChartNoAxesCombined size={20} className="text-muted-foreground" />
      </header>
      <div className="chart-tabs-scroll">
        <ToggleGroup
          value={[String(metric)]}
          onValueChange={(v) => {
            if (v.length) {
              setMetric(Number(v[0]));
              setKeyboard(null);
            }
          }}
          className="chart-tabs"
          aria-label="Métrica de la gráfica"
        >
          {labels.map((label, i) => (
            <ToggleGroupItem
              key={label}
              value={String(i)}
              className="chart-tab"
            >
              {metric === i && (
                <motion.span
                  layoutId="chart-selection"
                  className="chart-tab-indicator"
                  transition={{ duration: 0.2 }}
                />
              )}
              <span>{label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Feedback
        state={state}
        retry={retry}
        error="No pudimos cargar la tendencia diaria."
        empty="Sin actividad en el periodo"
      >
        <div
          className="chart-region"
          tabIndex={0}
          role="region"
          aria-label="Tendencia diaria. Usa las flechas para recorrer los días."
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              setKeyboard((k) =>
                Math.max(
                  0,
                  Math.min(
                    data.length - 1,
                    (k ?? -1) + (e.key === "ArrowRight" ? 1 : -1),
                  ),
                ),
              );
            }
          }}
        >
          {keyboard !== null && data[keyboard] && (
            <div className="keyboard-tooltip" aria-live="polite">
              {dateLabel(data[keyboard].date, true)} ·{" "}
              <strong>{format(data[keyboard].value)}</strong>
            </div>
          )}
          <ChartContainer
            config={{
              value: { label: labels[metric], color: "var(--chart-1)" },
            }}
            className="main-chart"
          >
            <AreaChart
              accessibilityLayer={false}
              data={data}
              margin={{ top: 18, right: 16, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0.16}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => dateLabel(d)}
                axisLine={false}
                tickLine={false}
                tickMargin={14}
                minTickGap={30}
              />
              <YAxis
                width={58}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  metric === 4 ? String(v) : v === 0 ? "$0" : `$${v / 1000}k`
                }
                tickCount={5}
              />
              <Tooltip
                cursor={{ stroke: "var(--primary)", strokeDasharray: "4 4" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="chart-tooltip">
                      <span>{dateLabel(String(label), true)}</span>
                      <p>
                        <span className="legend-dot" />
                        {labels[metric]}
                        <strong>{format(Number(payload[0].value))}</strong>
                      </p>
                    </div>
                  ) : null
                }
              />
              {keyboard !== null && data[keyboard] && (
                <ReferenceLine
                  x={data[keyboard].date}
                  stroke="var(--primary)"
                  strokeDasharray="4 4"
                />
              )}
              <Area
                dataKey="value"
                type="monotone"
                stroke="var(--color-value)"
                strokeWidth={2.5}
                fill="url(#area-fill)"
                activeDot={{
                  r: 5,
                  fill: "var(--primary)",
                  stroke: "var(--card)",
                  strokeWidth: 3,
                }}
                animationDuration={500}
                isAnimationActive={!reduced}
              />
            </AreaChart>
          </ChartContainer>
        </div>
        <footer className="chart-footer">
          <p>
            {labels[metric]} por día del {from} al {to} (Hasta excluyente)
          </p>
          <button
            className="table-toggle"
            onClick={() => setTable(!table)}
            aria-expanded={table}
          >
            <Table2 size={15} />
            Ver datos en tabla
            <ChevronDown
              size={14}
              style={{ transform: table ? "rotate(180deg)" : undefined }}
            />
          </button>
        </footer>
        {table && (
          <div className="data-table">
            <table>
              <caption className="sr-only">{labels[metric]} por día</caption>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>{labels[metric]}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.date}>
                    <td>{dateLabel(d.date, true)}</td>
                    <td>{format(d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Feedback>
    </section>
  );
}
```

## `components/dashboard-blocks.tsx`

Amount tween, shared Feedback states (loading, empty, error, stale, refresh) and the operational panel.

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  Inbox,
  Loader2,
  RotateCcw,
  ReceiptText,
  HandCoins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { money, panelInfo, rows, type DemoState } from "@/lib/dashboard-data";

export function Amount({
  value,
  count = false,
}: {
  value: number;
  count?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    const control = animate(previous.current, value, {
      duration: reduced ? 0 : 0.5,
      onUpdate: (v) => {
        if (ref.current)
          ref.current.textContent = count ? Math.round(v).toString() : money(v);
      },
    });
    previous.current = value;
    return () => control.stop();
  }, [value, count, reduced]);
  return <span ref={ref}>{count ? value : money(value)}</span>;
}
export function Feedback({
  state,
  retry,
  children,
  empty,
  loading,
  error,
}: {
  state: DemoState;
  retry: () => void;
  children: ReactNode;
  empty?: string;
  loading?: string;
  error?: string;
}) {
  const [retrying, setRetrying] = useState(false);
  const retryButton = (
    <Button
      variant="outline"
      disabled={retrying}
      onClick={() => {
        setRetrying(true);
        setTimeout(() => {
          retry();
          setRetrying(false);
        }, 650);
      }}
    >
      {retrying ? <Loader2 className="animate-spin" /> : <RotateCcw />}
      Reintentar
    </Button>
  );
  if (state === "loading")
    return (
      <div className="relative" role="status">
        <div className="invisible" aria-hidden="true" inert>
          {children}
        </div>
        <div className="loading-block absolute inset-0">
          <span className="sr-only">
            {loading ?? "Cargando el resumen de ventas…"}
          </span>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-56" />
          <Skeleton className="w-full flex-1" />
        </div>
      </div>
    );
  if (state === "empty")
    return (
      <div className="empty-block">
        <span className="empty-icon">
          <Inbox size={26} />
        </span>
        <strong>{empty ?? "Sin actividad en el periodo"}</strong>
        {!empty && (
          <p>
            No se registraron ventas ni reembolsos para el rango seleccionado.
          </p>
        )}
      </div>
    );
  if (["error", "denied", "rejected"].includes(state))
    return (
      <div className="error-block">
        <AlertCircle size={24} />
        <p>
          {state === "denied"
            ? "No tienes permiso para consultar el resumen de ventas de esta sucursal."
            : state === "rejected"
              ? "El servidor rechazó el rango de fechas. Ajusta el periodo e inténtalo de nuevo."
              : (error ??
                "No pudimos cargar el resumen de ventas. Reintenta en unos segundos.")}
        </p>
        {retryButton}
      </div>
    );
  return (
    <>
      {state === "stale" && (
        <Alert className="stale-alert">
          <AlertCircle />
          <AlertDescription>
            No pudimos actualizar el resumen; se muestran los últimos datos
            disponibles.
          </AlertDescription>
          {retryButton}
        </Alert>
      )}
      {state === "refresh" && (
        <div role="status" className="refresh-note">
          <Loader2 size={14} className="animate-spin" />
          Actualizando el resumen…
        </div>
      )}
      <div
        style={{
          opacity: state === "refresh" ? 0.6 : 1,
          transition: "opacity 200ms",
        }}
      >
        {children}
      </div>
    </>
  );
}
export function OperationalPanel({
  index,
  state,
  retry,
}: {
  index: number;
  state: DemoState;
  retry: () => void;
}) {
  const p = panelInfo[index];
  const Icon = [ReceiptText, HandCoins, RotateCcw][index];
  return (
    <section className="panel operations">
      <header className="operation-header">
        <span className="section-icon">
          <Icon size={18} />
        </span>
        <div>
          <h2>{p.title}</h2>
          <p>{p.description}</p>
        </div>
      </header>
      <Feedback
        state={state}
        retry={retry}
        empty={p.empty}
        error={p.error}
        loading={p.loading}
      >
        <div>
          {rows[index].map((row, i) => (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.045 }}
              className="operation-row"
              key={row[0]}
            >
              <div className="row-main">
                <div className="row-description">
                  <strong>{row[0]}</strong>
                  {index !== 2 && <span>{row[1]}</span>}
                  <span className="row-date">{row[2]}</span>
                </div>
                <div className="row-amount">
                  <span className={index ? "status warning" : "status"}>
                    {index === 0
                      ? "Venta confirmada"
                      : index === 1
                        ? "Deuda pendiente"
                        : "Pendiente"}
                  </span>
                  <strong className={index ? "text-warning" : ""}>
                    {money(Number(row[3]))}
                  </strong>
                </div>
              </div>
              {index === 2 && (
                <div className="refund-facts">
                  <p>
                    <span>Método</span>
                    {row[1]}
                  </p>
                  <p>
                    <span>Motivo</span>
                    {row[4]}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </Feedback>
    </section>
  );
}
```

## `app/globals.css`

Tokens, geometry and every layout rule, including the responsive breakpoints.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@custom-variant dark (&:is(.dark *));
@theme inline {
  --font-sans: var(--font-manrope), ui-sans-serif, system-ui;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--foreground);
  --color-popover: var(--card);
  --color-popover-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--muted);
  --color-secondary-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--selection);
  --color-accent-foreground: var(--primary);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--primary);
  --color-destructive: var(--destructive);
  --color-chart-1: var(--primary);
  --color-warning: var(--warning);
  --radius-sm: 6px;
  --radius-md: 6px;
  --radius-lg: 12px;
  --radius-xl: 12px;
}
:root {
  color-scheme: light;
  --background: #f5f6f8;
  --card: #ffffff;
  --foreground: #24313d;
  --heading: #173968;
  --muted: #e7eef7;
  --field: #ffffff;
  --input: #8593a3;
  --muted-foreground: #576574;
  --border: #dce2e8;
  --primary: #2442f6;
  --primary-foreground: #ffffff;
  --selection: #edf0ff;
  --gold: #f6bb13;
  --gold-soft: #fff5d6;
  --gold-ink: #443218;
  --warning: #805511;
  --warning-soft: #fff5d6;
  --success: #236044;
  --destructive: #b33434;
  --chart-1: var(--primary);
  --radius: 12px;
}
.dark {
  color-scheme: dark;
  --background: #0e1520;
  --card: #192332;
  --foreground: #edf2fa;
  --heading: #edf2fa;
  --muted: #202e43;
  --field: #121d2c;
  --input: #64758d;
  --muted-foreground: #adbcd0;
  --border: #354459;
  --primary: #91b0ff;
  --primary-foreground: #132344;
  --selection: #223555;
  --gold: #f2c456;
  --gold-soft: #3b311d;
  --gold-ink: #f2cb71;
  --warning: #f2cb71;
  --warning-soft: #3b311d;
  --success: #a2d9b9;
  --destructive: #ffaaaa;
}
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-variant-numeric: tabular-nums;
  }
  button,
  input,
  select {
    font: inherit;
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    cursor: wait;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 4px;
  }
  button,
  input,
  select {
    min-height: 44px;
  }
  h1,
  h2,
  h3 {
    color: var(--heading);
  }
  button,
  [data-slot="toggle-group-item"] {
    border-radius: 6px;
  }
  button:active {
    transform: scale(0.98);
  }
}
.dashboard {
  min-height: 100vh;
  padding: 52px 40px 76px;
  background: var(--background);
  font-size: 14px;
  line-height: 1.5;
  transition:
    background 200ms,
    color 200ms;
}
.dashboard-inner {
  max-width: 1320px;
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 8px;
}
.title-block {
  max-width: 650px;
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  letter-spacing: 1.5px;
  font-weight: 700;
  color: var(--muted-foreground);
  margin-bottom: 10px;
}
.brand-marker {
  height: 7px;
  width: 7px;
  background: var(--gold);
  border-radius: 2px;
}
h1 {
  font-size: 30px;
  line-height: 1.3;
  font-weight: 650;
  letter-spacing: -1.1px;
  text-wrap: balance;
}
.title-block > p {
  color: var(--muted-foreground);
  margin-top: 10px;
  font-size: 13px;
}
.period-controls {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  flex-shrink: 0;
}
.period-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted-foreground);
}
.period-meta > span:first-of-type {
  color: var(--foreground);
  font-weight: 550;
}
.period-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--muted-foreground);
}
.period-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.presets {
  padding: 4px;
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  gap: 0 !important;
}
.preset {
  position: relative;
  background: transparent !important;
  color: var(--muted-foreground) !important;
  padding: 0 14px !important;
  height: 44px !important;
  min-height: 44px;
  font-size: 12px !important;
  font-weight: 500 !important;
  border: 0 !important;
}
.preset[data-pressed] {
  color: var(--primary) !important;
}
.preset > span:last-child,
.chart-tab > span:last-child {
  position: relative;
}
.preset-indicator {
  position: absolute;
  inset: 0;
  background: var(--card);
  box-shadow: 0 1px 3px #0000000a;
  border-radius: 5px;
}
.range-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--card);
  border: 1px solid var(--border);
  height: 48px;
  width: 60px;
  color: var(--muted-foreground);
}
.range-popover {
  padding: 20px !important;
  width: 340px !important;
  gap: 16px !important;
}
.range-popover label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}
.range-popover input {
  border: 1px solid var(--input);
  border-radius: 6px;
  background: var(--field);
  padding: 8px 12px;
  width: 100%;
}
.range-popover p {
  font-size: 12px;
  color: var(--muted-foreground);
}
.panel {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 2px 3px #00000002;
  transition:
    background 200ms,
    border-color 200ms;
}
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 32px;
  overflow: hidden;
  gap: 32px;
  min-height: 201px;
}
.hero-content {
  flex-shrink: 0;
}
.metric-label {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--muted-foreground);
}
.metric-label h2 {
  font-size: 15px;
  font-weight: 600;
}
.hero-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--primary);
  background: var(--selection);
}
.hero-value {
  font-size: 48px;
  letter-spacing: -2px;
  line-height: 1.2;
  font-weight: 600;
  color: var(--heading);
  margin-top: 16px;
  white-space: nowrap;
}
.hero-value > span:last-child {
  font-size: 12px;
  letter-spacing: 0;
  font-weight: 500;
  color: var(--muted-foreground);
  margin-left: 12px;
}
.hero-content > p {
  color: var(--muted-foreground);
  font-size: 12px;
  margin-top: 10px;
}
.hero-visual {
  width: 55%;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding-top: 8px;
}
.hero-spark {
  height: 120px;
  width: 100%;
  aspect-ratio: auto !important;
}
.spark-dates {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted-foreground);
  padding-top: 8px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.metric-card {
  padding: 20px;
  position: relative;
  overflow: hidden;
  min-height: 147px;
}
.metric-card:hover {
  border-color: var(--primary);
}
.metric-card .metric-label {
  gap: 8px;
}
.metric-label h3 {
  font-size: 12px;
  font-weight: 500;
  color: var(--muted-foreground);
  white-space: nowrap;
}
.metric-value {
  font-size: 25px;
  font-weight: 600;
  letter-spacing: -0.7px;
  margin-top: 13px;
  position: relative;
  z-index: 1;
  white-space: nowrap;
}
.spark {
  height: 30px !important;
  width: 100%;
  aspect-ratio: auto !important;
  opacity: 0.6;
  margin-top: 10px;
}
.metric-card:hover .spark {
  opacity: 1;
}
.debt-card .metric-value,
.debt-card .metric-label {
  color: var(--warning);
}
.warning-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--warning);
  margin-left: auto;
}
.refund-group {
  padding-top: 24px;
}
.refund-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted-foreground);
  margin-bottom: 12px;
}
.refund-heading h2 {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
}
.refund-heading > span {
  font-size: 12px;
  margin-left: 4px;
  color: var(--muted-foreground);
}
.refund-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.refund-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  min-height: 72px;
}
.refund-item + .refund-item {
  border-left: 1px solid var(--border);
}
.refund-icon {
  height: 32px;
  width: 32px;
  background: var(--background);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--muted-foreground);
}
.refund-item > span:not(.refund-icon) {
  font-size: 12px;
  color: var(--muted-foreground);
}
.refund-item strong {
  margin-left: auto;
  font-size: 19px;
  letter-spacing: -0.4px;
  white-space: nowrap;
}
.warning {
  color: var(--warning) !important;
  background: var(--warning-soft) !important;
}
.trend {
  overflow: hidden;
  padding-top: 24px;
}
.chart-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
}
.chart-heading h2 {
  font-size: 16px;
  font-weight: 600;
}
.chart-heading p {
  color: var(--muted-foreground);
  font-size: 12px;
  margin-top: 4px;
}
.chart-tabs-scroll {
  overflow: auto;
  padding: 16px 24px 0;
}
.chart-tabs {
  gap: 4px !important;
}
.chart-tab {
  position: relative;
  color: var(--muted-foreground) !important;
  background: transparent !important;
  min-height: 40px !important;
  height: 40px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  padding: 0 14px !important;
  border: none !important;
}
.chart-tab[data-pressed] {
  color: var(--primary) !important;
}
.chart-tab-indicator {
  position: absolute;
  inset: 0;
  background: var(--selection);
  border-radius: 6px;
}
.chart-region {
  position: relative;
  padding: 10px 20px 0 8px;
}
.main-chart {
  height: 240px !important;
  width: 100%;
  aspect-ratio: auto !important;
}
.main-chart .recharts-cartesian-axis-tick text {
  fill: var(--muted-foreground);
  font-size: 12px;
}
.chart-tooltip {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  padding: 12px 16px;
  box-shadow: 0 4px 20px #0000000a;
  font-size: 12px;
}
.chart-tooltip > span {
  color: var(--muted-foreground);
}
.chart-tooltip p {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}
.chart-tooltip strong {
  margin-left: 16px;
}
.legend-dot {
  height: 6px;
  width: 6px;
  border-radius: 50%;
  background: var(--primary);
}
.keyboard-tooltip {
  position: absolute;
  right: 24px;
  top: 8px;
  font-size: 12px;
  background: var(--card);
  z-index: 1;
  border: 1px solid var(--border);
  padding: 8px;
  border-radius: 6px;
}
.chart-footer {
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  padding: 0 24px;
  min-height: 56px;
}
.chart-footer > p {
  font-size: 12px;
  color: var(--muted-foreground);
}
.table-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  white-space: nowrap;
  color: var(--muted-foreground);
}
.table-toggle:hover {
  color: var(--primary);
}
.data-table {
  max-height: 320px;
  overflow: auto;
  border-top: 1px solid var(--border);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
td,
th {
  padding: 10px 24px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}
td:last-child,
th:last-child {
  text-align: right;
}
th {
  background: var(--background);
  position: sticky;
  top: 0;
}
.operational-grid {
  display: grid;
  gap: 16px;
  align-items: start;
}
.operations {
  overflow: hidden;
  min-width: 0;
  min-height: 450px;
}
.operation-header {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 20px;
  border-bottom: 1px solid var(--border);
}
.section-icon {
  color: var(--muted-foreground);
  padding-top: 3px;
}
.operation-header h2 {
  font-size: 14px;
  font-weight: 600;
}
.operation-header p {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 4px;
}
.operation-row {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  transition: background 150ms;
}
.operation-row:last-child {
  border-bottom: 0;
}
.operation-row:hover {
  background: var(--background);
}
.row-main {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.row-description {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.row-description > strong {
  font-size: 12px;
  font-weight: 600;
}
.row-description > span {
  font-size: 12px;
  color: var(--muted-foreground);
}
.row-description .row-date {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 2px;
}
.row-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}
.status {
  font-size: 12px;
  color: var(--success);
  border-radius: 4px;
  white-space: nowrap;
  line-height: 1.5;
  padding: 2px 5px;
  background: color-mix(in srgb, var(--success) 7%, transparent);
}
.row-amount > strong {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.3px;
}
.refund-facts {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: var(--muted-foreground);
}
.refund-facts p {
  display: flex;
  gap: 8px;
}
.refund-facts p > span {
  width: 42px;
  color: var(--muted-foreground);
  opacity: 0.85;
}
.page-footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 12px;
  color: var(--muted-foreground);
  padding-top: 4px;
}
.footer-divider {
  margin: 0 12px;
  color: var(--border);
}
.demo-toolbar {
  position: fixed;
  bottom: 20px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: 0 4px 20px #0000000a;
  border-radius: 10px;
  padding: 0 10px;
  z-index: 40;
  font-size: 12px;
}
.demo-toolbar button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 6px;
}
.demo-tag {
  background: var(--gold-soft);
  color: var(--gold-ink);
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  padding: 3px 7px;
}
.toolbar-divider {
  height: 16px;
  width: 1px;
  background: var(--border);
}
.demo-panel {
  position: fixed;
  bottom: 76px;
  right: 24px;
  width: 340px;
  max-height: 75vh;
  overflow: auto;
  z-index: 40;
  padding: 20px;
  box-shadow: 0 8px 40px #00000014;
}
.demo-panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.demo-panel p {
  font-size: 12px;
  color: var(--muted-foreground);
  margin-bottom: 12px;
}
.demo-panel label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  padding: 6px 0;
}
.demo-panel select {
  max-width: 150px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--field);
  font-size: 12px;
  padding: 0 8px;
}
.empty-block,
.error-block {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 32px;
  color: var(--muted-foreground);
  font-size: 13px;
}
.empty-icon {
  background: var(--muted);
  border: 6px solid var(--background);
  box-shadow: 0 0 0 1px var(--border);
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 8px;
}
.empty-block strong {
  color: var(--foreground);
  font-weight: 600;
}
.error-block > svg {
  color: var(--destructive);
}
.loading-block {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
}
.loading-block [data-slot="skeleton"] {
  background: linear-gradient(
    90deg,
    var(--muted),
    var(--background),
    var(--muted)
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s infinite;
}
.refresh-note {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--primary);
  padding: 8px 0;
}
.stale-alert {
  display: flex !important;
  align-items: center;
  gap: 12px;
  background: var(--warning-soft) !important;
  color: var(--warning) !important;
  margin-bottom: 12px;
  font-size: 12px;
}
.stale-alert button {
  margin-left: auto;
  flex-shrink: 0;
}
.stale-alert svg {
  position: static !important;
}
.metrics-section > .empty-block,
.metrics-section > .loading-block,
.metrics-section > .error-block {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  min-height: 444px;
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
@media (min-width: 1500px) {
  .dashboard {
    padding-top: 64px;
  }
  .hero {
    min-height: 220px;
  }
  .main-chart {
    height: 270px !important;
  }
}
@media (max-width: 1190px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .period-controls {
    align-items: flex-start;
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  .metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .metric-card:nth-last-child(-n + 2) {
    grid-column: auto;
  }
  .operational-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
  .operations:last-child:nth-child(3) {
    grid-column: 1/-1;
    min-height: 0;
  }
  .refund-item {
    padding: 16px;
  }
  .refund-item > span:not(.refund-icon) {
    font-size: 12px;
  }
  .refund-item strong {
    font-size: 17px;
  }
  .operation-header p {
    font-size: 12px;
  }
}
@media (max-width: 700px) {
  .dashboard {
    padding: 28px 16px 90px;
  }
  .dashboard-inner {
    gap: 20px;
  }
  .page-header {
    gap: 20px;
    padding: 0;
  }
  .title-block > p {
    font-size: 13px;
    max-width: 340px;
    line-height: 1.7;
  }
  h1 {
    font-size: 28px;
  }
  .period-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .period-actions {
    width: 100%;
  }
  .preset-scroll {
    overflow-x: auto;
    flex: 1;
    min-width: 0;
  }
  .presets {
    width: max-content;
  }
  .preset {
    padding: 0 12px !important;
    font-size: 12px !important;
    min-height: 44px !important;
  }
  .range-trigger {
    width: 44px;
    flex-shrink: 0;
    height: 54px;
  }
  .range-trigger > svg:last-child {
    display: none;
  }
  .hero {
    padding: 24px;
    gap: 16px;
    min-height: 0;
    display: block;
  }
  .hero-value {
    font-size: 43px;
  }
  .hero-visual {
    width: 100%;
    margin-top: 12px;
  }
  .hero-spark {
    height: 85px;
  }
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .metric-card {
    padding: 16px;
    min-height: 140px;
  }
  .metric-card:last-child {
    grid-column: 1/-1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    min-height: 110px;
  }
  .metric-card:last-child .metric-value {
    grid-row: 2;
  }
  .metric-card:last-child .spark {
    grid-column: 2;
    grid-row: 1/3;
    height: 50px !important;
  }
  .metric-value {
    font-size: 24px;
  }
  .metric-label h3 {
    font-size: 12px;
  }
  .metric-label {
    gap: 6px !important;
  }
  .refund-heading > span {
    display: none;
  }
  .refund-grid {
    grid-template-columns: 1fr;
  }
  .refund-item + .refund-item {
    border-left: none;
    border-top: 1px solid var(--border);
  }
  .refund-item > span:not(.refund-icon) {
    max-width: 180px;
  }
  .refund-item {
    gap: 10px;
  }
  .refund-item strong {
    font-size: 16px;
  }
  .chart-heading {
    padding: 0 20px;
  }
  .chart-tabs-scroll {
    padding: 16px 12px 0;
  }
  .chart-region {
    padding: 8px 4px 0 0;
  }
  .main-chart {
    height: 220px !important;
  }
  .chart-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    padding: 12px 20px 4px;
  }
  .chart-footer > p {
    line-height: 1.6;
    font-size: 12px;
  }
  .operational-grid {
    grid-template-columns: 1fr !important;
  }
  .operations:last-child:nth-child(3) {
    grid-column: auto;
  }
  .operations {
    min-height: 0;
  }
  .operation-header p {
    font-size: 12px;
  }
  .row-description .row-date {
    font-size: 12px;
  }
  .row-description > strong,
  .row-description > span {
    font-size: 13px;
  }
  .status {
    font-size: 12px;
  }
  .refund-facts {
    font-size: 12px;
  }
  .page-footer {
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
  }
  .demo-toolbar {
    right: 16px;
    bottom: 16px;
  }
  .demo-panel {
    right: 16px;
    width: calc(100% - 32px);
  }
  .isolate:has(> .range-popover) {
    position: fixed !important;
    inset: auto 0 0 0 !important;
    transform: none !important;
    width: 100% !important;
  }
  .range-popover {
    position: relative !important;
    width: 100% !important;
    border-radius: 12px 12px 0 0 !important;
    transform: none !important;
    padding-bottom: 32px !important;
  }
  .stale-alert {
    flex-wrap: wrap;
  }
}
.operational-grid[data-panels="1"] { grid-template-columns: minmax(0, 1fr) !important; }
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
```
