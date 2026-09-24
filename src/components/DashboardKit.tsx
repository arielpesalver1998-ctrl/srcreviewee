import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";

export type Tone = "blue" | "emerald" | "sky" | "amber" | "purple" | "teal" | "rose";

const toneClasses: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
  purple: "bg-purple-50 text-purple-600",
  teal: "bg-teal-50 text-teal-600",
  rose: "bg-rose-50 text-rose-600",
};

export function StatCard({
  label,
  value,
  icon,
  tone = "teal",
  loading,
  subtitle,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: Tone;
  loading?: boolean;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl sm:rounded-[1.5rem] border border-slate-200 bg-white p-3 sm:p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md w-full"
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-bold text-slate-600 truncate">{label}</p>
          <h3 className="mt-1 sm:mt-2 text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 truncate">
            {loading ? <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" /> : value}
          </h3>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-semibold text-emerald-600 truncate">
            {subtitle || "+2.31% vs last month"}
          </p>
        </div>

        <div className={`flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl ${toneClasses[tone]}`}>
          {icon}
        </div>
      </div>
    </button>
  );
}

export type ActivityItem = {
  id: string;
  icon: React.ReactNode;
  title: string;
  meta: string;
  tag?: string;
  tone?: Tone;
};

export function ActivityFeed({
  items,
  loading,
  emptyLabel = "No activity yet.",
}: {
  items: ActivityItem[];
  loading?: boolean;
  emptyLabel?: string;
}) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClasses[item.tone || "teal"]}`}>
            {item.icon}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-900">
              {item.title}
            </p>
            <p className="truncate text-xs font-semibold text-slate-500">
              {item.meta}
            </p>
          </div>

          {item.tag && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
              {item.tag}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function QuickActionsGrid({
  actions,
}: {
  actions: {
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {actions.map((action) => (
        <button
          key={action.key}
          onClick={action.onClick}
          className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-[#007C89]">
            {action.icon}
          </div>
          <p className="mt-3 text-xs font-black text-slate-800">
            {action.label}
          </p>
        </button>
      ))}
    </div>
  );
}

export function SimpleTable({
  rows,
  columns,
  loading,
  emptyLabel,
  compact = false,
  bordered = false,
}: {
  rows: any[];
  columns: {
    key: string;
    header: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    className?: string;
    headerClassName?: string;
    render: (row: any) => React.ReactNode;
  }[];
  loading?: boolean;
  emptyLabel?: string;
  compact?: boolean;
  bordered?: boolean;
}) {
  if (loading) {
    return (
      <div className={`flex items-center justify-center text-slate-400 ${compact ? 'h-24' : 'h-40'}`}>
        <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className={`flex items-center justify-center text-xs font-semibold text-slate-400 ${compact ? 'h-20' : 'h-32'}`}>
        {emptyLabel || "No records found."}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${bordered ? 'rounded-2xl border border-slate-200/90 shadow-xs' : ''}`}>
      <table className="w-full min-w-[760px] text-left border-collapse">
        <thead>
          <tr className={`border-b border-slate-200 bg-slate-50/90 ${bordered ? 'divide-x divide-slate-200' : ''}`}>
            {columns.map((col) => {
              const alignClass = col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';
              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-3 sm:px-3.5 ${compact ? 'py-2.5' : 'py-3.5'} text-[10px] font-black uppercase tracking-widest text-slate-500 select-none ${alignClass} ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody className={`divide-y divide-slate-100 ${bordered ? 'divide-y divide-slate-200/80' : ''}`}>
          {rows.map((row, index) => (
            <tr
              key={row.id ? `${row.id}_${index}` : `row_${index}`}
              className={`hover:bg-slate-50/80 transition-colors ${bordered ? 'divide-x divide-slate-200/70' : ''}`}
            >
              {columns.map((col) => {
                const alignClass = col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';
                return (
                  <td
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={`px-3 sm:px-3.5 ${compact ? 'py-2.5 text-xs' : 'py-3.5 text-sm'} align-middle ${alignClass} ${col.className || ''}`}
                  >
                    {col.render(row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionHeader({
  title,
  onViewAll,
}: {
  title: string;
  onViewAll?: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-base font-black text-slate-900">{title}</h3>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs font-black text-[#007C89]"
        >
          View All <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
