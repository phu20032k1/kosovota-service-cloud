"use client";

import { Icon, type IconName } from "./Icon";

type ConfirmTone = "danger" | "warning" | "info";

const toneClass: Record<ConfirmTone, { icon: string; confirm: string; badge: string; defaultIcon: IconName }> = {
  danger: {
    icon: "bg-rose-50 text-rose-700 ring-rose-100",
    confirm: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-300",
    badge: "bg-rose-50 text-rose-700",
    defaultIcon: "trash",
  },
  warning: {
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    confirm: "bg-amber-600 text-white hover:bg-amber-700 focus-visible:outline-amber-300",
    badge: "bg-amber-50 text-amber-700",
    defaultIcon: "alert",
  },
  info: {
    icon: "bg-blue-50 text-blue-700 ring-blue-100",
    confirm: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-300",
    badge: "bg-blue-50 text-blue-700",
    defaultIcon: "info",
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  highlight,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "danger",
  busy = false,
  icon,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  highlight?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  busy?: boolean;
  icon?: IconName;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const styles = toneClass[tone];

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="w-full max-w-md animate-pop rounded-[1.75rem] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
        <div className="flex items-start gap-4">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 ${styles.icon}`}>
            <Icon name={icon || styles.defaultIcon} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p id="confirm-dialog-title" className="text-lg font-black text-slate-950">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            {highlight && <p className={`mt-3 rounded-2xl px-3 py-2 text-sm font-extrabold ${styles.badge}`}>{highlight}</p>}
          </div>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={onCancel} className="btn-secondary justify-center disabled:opacity-60">
            {cancelLabel}
          </button>
          <button type="button" disabled={busy} onClick={onConfirm} className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black shadow-sm transition disabled:opacity-60 ${styles.confirm}`}>
            {busy && <span className="animate-spin"><Icon name="refresh" size={17} /></span>}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
