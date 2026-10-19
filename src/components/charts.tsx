"use client";

import React, { useSyncExternalStore } from "react";

const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const motionSnapshot = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverMotionSnapshot = () => false;
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { inrCompact, num, pctStr } from "@/lib/format";

export const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const axis = {
  stroke: "var(--text-faint)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

type TipPayload = { name?: string; value?: number | string; color?: string }[];

function TipBox({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: TipPayload;
  label?: string | number;
  fmt?: (k: string, v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border px-3 py-2 text-[12px]"
      style={{ background: "var(--bg-elevated)", boxShadow: "var(--shadow-lg)" }}
    >
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span style={{ color: "var(--text-muted)" }}>{p.name}</span>
          </span>
          <span className="num font-medium">
            {fmt && typeof p.value === "number"
              ? fmt(String(p.name), p.value)
              : typeof p.value === "number"
                ? num(p.value, Number.isInteger(p.value) ? 0 : 1)
                : String(p.value ?? "")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({
  data,
  series,
  height = 260,
  fmt,
  onDrill,
}: {
  data: Record<string, string | number>[];
  series: { key: string; name: string; color: string; type?: "area" | "line" | "bar"; yAxis?: "left" | "right" }[];
  onDrill?: (date: string) => void;
  height?: number;
  fmt?: (k: string, v: number) => string;
}) {
  const animate = useSyncExternalStore(subscribeMotion, motionSnapshot, serverMotionSnapshot);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart onClick={(state) => { if (state.activeLabel != null) onDrill?.(String(state.activeLabel)); }} style={{ cursor: onDrill ? "pointer" : undefined }} data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="date" {...axis} minTickGap={24} />
        <YAxis {...axis} width={52} />
        {series.some((s) => s.yAxis === "right") && (
          <YAxis yAxisId="right" orientation="right" {...axis} width={44} />
        )}
        <Tooltip content={<TipBox fmt={fmt} />} cursor={{ stroke: "var(--border-strong)" }} />
        {series.map((s) =>
          s.type === "bar" ? (
            <Bar isAnimationActive={animate} animationDuration={850} key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} yAxisId={s.yAxis === "right" ? "right" : undefined} />
          ) : s.type === "line" ? (
            <Line isAnimationActive={animate} animationDuration={1000}
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              yAxisId={s.yAxis === "right" ? "right" : undefined}
            />
          ) : (
            <Area isAnimationActive={animate} animationDuration={1000}
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#g-${s.key})`}
              yAxisId={s.yAxis === "right" ? "right" : undefined}
            />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function BarRank({
  data,
  dataKey = "value",
  nameKey = "key",
  height = 280,
  color = "var(--chart-1)",
  money,
  onClick,
}: {
  data: Record<string, string | number>[];
  dataKey?: string;
  nameKey?: string;
  height?: number;
  color?: string;
  money?: boolean;
  onClick?: (key: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--grid)" horizontal={false} />
        <XAxis type="number" {...axis} tickFormatter={(v) => (money ? inrCompact(v) : num(v))} />
        <YAxis type="category" dataKey={nameKey} {...axis} width={132} />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={<TipBox fmt={(k, v) => (money ? inrCompact(v) : num(v, Number.isInteger(v) ? 0 : 1))} />}
        />
        <Bar
          dataKey={dataKey}
          radius={[0, 5, 5, 0]}
          onClick={(d: unknown) => onClick?.(String((d as Record<string, string>)[nameKey]))}
          cursor={onClick ? "pointer" : undefined}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={color} opacity={1 - Math.min(i * 0.055, 0.5)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 250,
  onClick,
  money,
}: {
  data: { key: string; value: number }[];
  height?: number;
  onClick?: (k: string) => void;
  money?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="key"
          innerRadius="56%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="var(--surface)"
          strokeWidth={2}
          onClick={(d: unknown) => onClick?.(String((d as { key: string }).key))}
          cursor={onClick ? "pointer" : undefined}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<TipBox fmt={(k, v) => (money ? inrCompact(v) : num(v))} />} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 11.5, color: "var(--text-muted)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ScatterPlot({
  data,
  xName,
  yName,
  height = 320,
  onClick,
}: {
  data: { x: number; y: number; z: number; name: string }[];
  xName: string;
  yName: string;
  height?: number;
  onClick?: (name: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 16, left: -8, bottom: 10 }}>
        <CartesianGrid stroke="var(--grid)" />
        <XAxis type="number" dataKey="x" name={xName} {...axis} />
        <YAxis type="number" dataKey="y" name={yName} {...axis} tickFormatter={(v) => `${v}%`} />
        <ZAxis type="number" dataKey="z" range={[60, 460]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { name: string; x: number; y: number; z: number };
            return (
              <div
                className="rounded-xl border px-3 py-2 text-[12px]"
                style={{ background: "var(--bg-elevated)", boxShadow: "var(--shadow-lg)" }}
              >
                <p className="font-semibold">{p.name}</p>
                <p className="text-muted">
                  {xName}: <span className="num">{num(p.x)}</span>
                </p>
                <p className="text-muted">
                  {yName}: <span className="num">{pctStr(p.y)}</span>
                </p>
                <p className="text-muted">
                  LTV: <span className="num">{inrCompact(p.z)}</span>
                </p>
              </div>
            );
          }}
        />
        <Scatter
          data={data}
          fill="var(--chart-1)"
          fillOpacity={0.7}
          onClick={(d: unknown) => onClick?.((d as { name: string }).name)}
          cursor={onClick ? "pointer" : undefined}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function MiniArea({ data, color = "var(--chart-1)", dataKey = "leads" }: { data: Record<string, string | number>[]; color?: string; dataKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <Area dataKey={dataKey} stroke={color} strokeWidth={1.6} fill={color} fillOpacity={0.12} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
