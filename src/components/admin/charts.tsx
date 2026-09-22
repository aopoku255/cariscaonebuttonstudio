"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";

import { formatMoney } from "@/lib/utils";

/**
 * Dashboard charts.
 *
 * Design rules applied throughout:
 *  · One y-axis per chart. Revenue and bookings are separate charts rather than a
 *    dual-axis hybrid, because two scales on one frame cannot be read honestly.
 *  · Single-series charts carry no legend (the chart title names the series) and
 *    use one brand hue, which passes contrast against the white card surface.
 *  · The payment-status chart uses reserved status colours. Two of those sit below
 *    3:1 on a light surface, so every bar is directly labelled with its name and
 *    value: colour reinforces the reading, it never carries it alone.
 *  · Grid and axes are recessive; all text uses ink tokens, never a series colour.
 */

const SERIES = "#245a49"; // brand-600: 6.2:1 on white
const SERIES_SOFT = "rgba(36, 90, 73, 0.12)";
const GRID = "#e4e0d6";
const AXIS_INK = "#6e6a5e";

/** Reserved status colours. `Refunded` is neutral rather than an error tone. */
export const STATUS_COLORS: Record<string, string> = {
  Paid: "#0ca30c",
  Pending: "#fab219",
  Failed: "#d03b3b",
  Refunded: "#52514e",
};

const AXIS_PROPS = {
  stroke: GRID,
  tick: { fill: AXIS_INK, fontSize: 11 },
  tickLine: false,
} as const;

function ChartFrame({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-4">
        <h3 className="text-[14.5px] font-semibold text-ink">{title}</h3>
        {description ? <p className="mt-0.5 text-[12.5px] text-muted">{description}</p> : null}
      </div>
      {children}
      {footer ? <div className="mt-3 border-t border-line pt-3">{footer}</div> : null}
    </div>
  );
}

function TooltipBox({
  label,
  rows,
}: {
  label?: string;
  rows: { name: string; value: string }[];
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-lg shadow-ink/5">
      {label ? <p className="text-[12px] font-semibold text-ink">{label}</p> : null}
      {rows.map((row) => (
        <p key={row.name} className="mt-0.5 text-[12px] text-muted">
          {row.name}: <span className="font-semibold text-ink">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

interface SeriesPoint {
  date: string;
  label: string;
  revenue: number;
  bookings: number;
}

export function RevenueChart({ data }: { data: SeriesPoint[] }) {
  const total = data.reduce((sum, point) => sum + point.revenue, 0);

  return (
    <ChartFrame
      title="Revenue over time"
      description="Payments received, by the day they were confirmed."
      footer={
        <p className="text-[12.5px] text-muted">
          Total for this period:{" "}
          <span className="font-semibold text-ink">{formatMoney(Math.round(total * 100))}</span>
        </p>
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={28} />
          <YAxis
            {...AXIS_PROPS}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => `₵${value >= 1000 ? `${value / 1000}k` : value}`}
          />
          <Tooltip
            cursor={{ stroke: AXIS_INK, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  label={String(label)}
                  rows={[
                    {
                      name: "Revenue",
                      value: formatMoney(Math.round(Number(payload[0].value) * 100)),
                    },
                  ]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={SERIES}
            strokeWidth={2}
            fill={SERIES_SOFT}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function BookingsChart({ data }: { data: SeriesPoint[] }) {
  const total = data.reduce((sum, point) => sum + point.bookings, 0);

  return (
    <ChartFrame
      title="Bookings over time"
      description="Bookings created, by the day they were made."
      footer={
        <p className="text-[12.5px] text-muted">
          Total for this period: <span className="font-semibold text-ink">{total}</span>
        </p>
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={28} />
          <YAxis {...AXIS_PROPS} axisLine={false} width={40} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(36,90,73,0.06)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  label={String(label)}
                  rows={[{ name: "Bookings", value: String(payload[0].value) }]}
                />
              ) : null
            }
          />
          {/* 4px rounded data-end, anchored flat to the baseline. */}
          <Bar dataKey="bookings" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

interface NamedCount {
  name: string;
  value: number;
  revenue?: number;
}

/** Horizontal bars with direct labels: used wherever the categories are named things. */
export function RankedBarChart({
  title,
  description,
  data,
  unit = "bookings",
  colorByName,
  emptyMessage = "No data yet.",
}: {
  title: string;
  description?: string;
  data: NamedCount[];
  unit?: string;
  /** When set, each bar takes its reserved status colour. */
  colorByName?: Record<string, string>;
  emptyMessage?: string;
}) {
  if (data.length === 0) {
    return (
      <ChartFrame title={title} description={description}>
        <p className="py-10 text-center text-[13px] text-muted">{emptyMessage}</p>
      </ChartFrame>
    );
  }

  const height = Math.max(160, data.length * 38 + 20);

  return (
    <ChartFrame title={title} description={description}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
          barCategoryGap={6}
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" {...AXIS_PROPS} axisLine={false} allowDecimals={false} hide />
          <YAxis
            type="category"
            dataKey="name"
            {...AXIS_PROPS}
            axisLine={false}
            width={132}
            tick={{ fill: "#3d3b33", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(36,90,73,0.06)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  label={String(payload[0].payload.name)}
                  rows={[
                    { name: unit, value: String(payload[0].value) },
                    ...(payload[0].payload.revenue !== undefined
                      ? [
                          {
                            name: "Revenue",
                            value: formatMoney(payload[0].payload.revenue * 100),
                          },
                        ]
                      : []),
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={colorByName?.[entry.name] ?? SERIES}
                // 2px surface ring keeps adjacent fills from touching.
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}
            {/* Direct labels: the value is always readable without relying on colour. */}
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              style={{ fill: "#3d3b33", fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
