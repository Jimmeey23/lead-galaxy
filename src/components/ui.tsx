"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cx, delta, pctStr } from "@/lib/format";

/* ------------------------------- Primitives ------------------------------ */
export function Card({
  className,
  children,
  title,
  subtitle,
  actions,
  padded = true,
}: {
  className?: string;
  children?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={cx("card animate-in overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b bg-[var(--surface)]/60 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
            {subtitle && <p className="text-muted mt-0.5 text-[11.5px] leading-snug">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function IconBadge({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "positive" | "warning" | "info" | "muted" }) {
  const map: Record<string, React.CSSProperties> = {
    accent: { background: "var(--accent-soft)", color: "var(--accent)" },
    positive: { background: "var(--positive-soft)", color: "var(--positive)" },
    warning: { background: "var(--warning-soft)", color: "var(--warning)" },
    info: { background: "var(--info-soft)", color: "var(--info)" },
    muted: { background: "var(--surface-2)", color: "var(--text-muted)" },
  };
  return <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl" style={map[tone]}>{children}</span>;
}

export function Button({
  children,
  variant = "ghost",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "subtle";
  size?: "sm" | "md";
}) {
  const base =
    "focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-150 disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { sm: "h-7 px-2.5 text-[12px]", md: "h-9 px-3.5 text-[13px]" };
  const styles: Record<string, string> = {
    primary: "text-[var(--accent-contrast)] hover:brightness-[1.07] active:scale-[0.98]",
    ghost: "hover:bg-[var(--surface-2)]",
    subtle: "bg-[var(--surface-2)] hover:bg-[var(--surface-3)]",
    outline: "border bg-[var(--surface)] hover:bg-[var(--surface-2)]",
    danger: "text-[var(--critical)] hover:bg-[var(--critical-soft)]",
  };
  return (
    <button
      {...props}
      className={cx(base, sizes[size], styles[variant], className)}
      style={variant === "primary" ? { background: "var(--accent)", ...props.style } : props.style}
    >
      {children}
    </button>
  );
}

export function Chip({
  children,
  tone = "neutral",
  onRemove,
  onClick,
  active,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "critical" | "info" | "accent";
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
}) {
  const tones: Record<string, React.CSSProperties> = {
    neutral: { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" },
    positive: { background: "var(--positive-soft)", color: "var(--positive)" },
    warning: { background: "var(--warning-soft)", color: "var(--warning)" },
    critical: { background: "var(--critical-soft)", color: "var(--critical)" },
    info: { background: "var(--info-soft)", color: "var(--info)" },
    accent: { background: "var(--accent-soft)", color: "var(--accent)" },
  };
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      style={active ? tones.accent : tones[tone]}
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors",
        onClick && "hover:brightness-95 cursor-pointer",
      )}
    >
      {children}
      {onRemove && (
        <X size={12} className="cursor-pointer opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onRemove(); }} />
      )}
    </Comp>
  );
}

export function Input({
  icon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }) {
  return (
    <div className="relative w-full">
      {icon && <span className="text-faint pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2">{icon}</span>}
      <input {...props} className={cx("focus-ring h-9 w-full rounded-xl border bg-[var(--surface)] px-3 text-[13px] transition-colors", icon ? "pl-8" : "", className)} />
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="focus-ring h-9 w-full appearance-none rounded-xl border bg-[var(--surface)] pr-8 pl-3 text-[13px]">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="text-faint pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2" />
    </div>
  );
}

export function Popover({
  trigger,
  children,
  align = "left",
  width = 280,
}: {
  trigger: (open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, []);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div style={{ width, boxShadow: "var(--shadow-lg)", background: "var(--bg-elevated)" }}
          className={cx("animate-in absolute top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-auto rounded-2xl border p-2", align === "right" ? "right-0" : "left-0")}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  width = 260,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  width?: number;
}) {
  const [q, setQ] = useState("");
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  return (
    <Popover width={width} trigger={() => (
      <button className="focus-ring flex h-9 w-full items-center justify-between gap-2 rounded-xl border bg-[var(--surface)] px-3 text-[13px] hover:bg-[var(--surface-2)]">
        <span className="truncate">{label}{value.length > 0 && <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}>{value.length}</span>}</span>
        <ChevronDown size={14} className="text-faint shrink-0" />
      </button>
    )}>
      {() => (
        <div>
          <div className="mb-1.5"><Input icon={<Search size={13} />} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-faint text-[11px]">{filtered.length} options</span>
            <button className="text-[11px] font-medium hover:underline" style={{ color: "var(--accent)" }} onClick={() => onChange([])}>Clear</button>
          </div>
          <div className="max-h-64 overflow-auto">
            {filtered.map((o) => (
              <button key={o} onClick={() => toggle(o)} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[12.5px] hover:bg-[var(--surface-2)]">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border" style={value.includes(o) ? { background: "var(--accent)", borderColor: "var(--accent)" } : undefined}>
                  {value.includes(o) && <Check size={11} color="var(--accent-contrast)" />}
                </span>
                <span className="truncate">{o}</span>
              </button>
            ))}
            {!filtered.length && <p className="text-faint px-2 py-3 text-center text-[12px]">No matches</p>}
          </div>
        </div>
      )}
    </Popover>
  );
}

/* --------------------------------- KPI ---------------------------------- */
export function Kpi({
  label,
  value,
  sub,
  compare,
  invert,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  compare?: { current: number; previous: number } | null;
  invert?: boolean;
  onClick?: () => void;
}) {
  const d = compare ? delta(compare.current, compare.previous) : null;
  const good = d ? (invert ? !d.up : d.up) : null;
  return (
    <div onClick={onClick} className={cx("card group relative p-4 transition-all duration-200", onClick && "cursor-pointer hover:-translate-y-0.5")}>
      <p className="text-muted text-[11px] font-medium tracking-wide uppercase">{label}</p>
      <p className="num mt-2 text-[24px] leading-none font-semibold tracking-tight">{value}</p>
      <div className="mt-2.5 flex items-center gap-2">
        {d && <span className="num rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: good ? "var(--positive-soft)" : "var(--critical-soft)", color: good ? "var(--positive)" : "var(--critical)" }}>{d.pct == null ? "new" : `${d.up ? "↑" : "↓"} ${pctStr(Math.abs(d.pct))}`}</span>}
        {sub && <span className="text-faint truncate text-[11.5px]">{sub}</span>}
      </div>
    </div>
  );
}

export function GraphicKpi({
  label,
  value,
  sub,
  icon,
  tone = "accent",
  trend,
  compare,
  invert,
  onClick,
  spark,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "accent" | "positive" | "warning" | "info" | "critical";
  trend?: number[];
  compare?: { current: number; previous: number } | null;
  invert?: boolean;
  onClick?: () => void;
  spark?: React.ReactNode;
}) {
  const d = compare ? delta(compare.current, compare.previous) : null;
  const good = d ? (invert ? !d.up : d.up) : null;
  const toneColor: Record<string, string> = {
    accent: "var(--accent)",
    positive: "var(--positive)",
    warning: "var(--warning)",
    info: "var(--info)",
    critical: "var(--critical)",
  };
  return (
    <div onClick={onClick} className={cx("metric-card kpi-card", onClick && "cursor-pointer card-hover")}>
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="kpi-label text-muted text-[10.5px] font-semibold tracking-[0.09em] uppercase">{label}</p>
            <p className="kpi-value num mt-3">{value}</p>

          </div>
          {icon && <span className="kpi-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: `color-mix(in srgb, ${toneColor[tone]} 14%, var(--surface))`, color: toneColor[tone], border: `1px solid color-mix(in srgb, ${toneColor[tone]} 18%, transparent)` }}>{icon}</span>}
        </div>
        {sub && <p className="kpi-detail text-muted text-[11.5px] leading-snug">{sub}</p>}
        {(d || spark) && (
          <div className="mt-3 flex items-center gap-2">
            {d && <span className="num inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: good ? "var(--positive-soft)" : "var(--critical-soft)", color: good ? "var(--positive)" : "var(--critical)" }}>{d.pct == null ? "new" : `${d.up ? "↗" : "↘"} ${pctStr(Math.abs(d.pct))}`}</span>}
            {spark && <div className="ml-auto opacity-80">{spark}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Feedback -------------------------------- */
export function Skeleton({ className }: { className?: string }) { return <div className={cx("shimmer rounded-xl", className)} />; }

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>{icon}</div>
      <p className="text-[14px] font-semibold">{title}</p>
      {description && <p className="text-muted max-w-sm text-[12.5px]">{description}</p>}
      {action}
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 540,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[80] flex justify-end">
      <div className="absolute inset-0 backdrop-blur-[2px]" style={{ background: "rgba(10,10,14,0.45)" }} onClick={onClose} />
      <aside className="animate-drawer relative flex h-full flex-col border-l" style={{ width: `min(${width}px, 100%)`, background: "var(--bg-elevated)", boxShadow: "var(--shadow-lg)" }}>
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="text-muted mt-0.5 text-[12px]">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X size={15} /></Button>
        </header>
        <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t px-5 py-3" style={{ background: "var(--bg-elevated)" }}>{footer}</footer>}
      </aside>
    </div>
  );
}

export function Toggle({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-xl p-0.5" style={{ background: "var(--surface-2)" }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cx("focus-ring rounded-[10px] font-medium transition-all", size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[12.5px]", value === o.value ? "shadow-sm" : "text-muted hover:text-[var(--text)]")} style={value === o.value ? { background: "var(--surface)", color: "var(--text)" } : undefined}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatBar({ value, max, tone }: { value: number; max: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: tone ?? "var(--accent)" }} />
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 w-max max-w-[260px] -translate-x-1/2 rounded-xl border px-2.5 py-1.5 text-[11.5px] opacity-0 transition-opacity group-hover/tt:opacity-100" style={{ background: "var(--bg-elevated)", boxShadow: "var(--shadow-lg)" }}>{label}</span>
    </span>
  );
}

export function SectionHeader({ title, subtitle, icon, action }: { title: string; subtitle?: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex gap-3">
        {icon && <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{icon}</span>}
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="text-muted mt-0.5 text-[12.5px]">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
