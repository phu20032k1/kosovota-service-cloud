"use client";

import { useEffect, useId, useRef } from "react";
import { Icon, type IconName } from "./Icon";

type ConfirmTone = "danger" | "warning" | "info";

const toneClass: Record<ConfirmTone, { icon: string; confirm: string; badge: string; defaultIcon: IconName; eyebrow: string }> = {
  danger: {
    icon: "bg-rose-50 text-rose-700 ring-rose-100",
    confirm: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-300",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
    defaultIcon: "trash",
    eyebrow: "Thao tác quan trọng",
  },
  warning: {
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    confirm: "bg-amber-600 text-white hover:bg-amber-700 focus-visible:outline-amber-300",
    badge: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100",
    defaultIcon: "alert",
    eyebrow: "Cần xác nhận",
  },
  info: {
    icon: "bg-blue-50 text-blue-700 ring-blue-100",
    confirm: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-300",
    badge: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100",
    defaultIcon: "info",
    eyebrow: "Xác nhận thao tác",
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
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onCancel, open]);

  if (!open) return null;

  const styles = toneClass[tone];

  return (
    <div
      className="web-dialog-backdrop"
      role={tone === "danger" ? "alertdialog" : "dialog"}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div className="web-dialog-panel max-w-md">
        <div className="flex items-start gap-4">
          <span className={`web-dialog-icon ring-1 ${styles.icon}`}>
            <Icon name={icon || styles.defaultIcon} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{styles.eyebrow}</p>
                <h2 id={titleId} className="mt-1 text-xl font-black leading-tight text-slate-950">{title}</h2>
              </div>
              <button type="button" disabled={busy} onClick={onCancel} className="icon-button !h-9 !w-9 shrink-0 disabled:opacity-50" aria-label="Đóng">
                <Icon name="x" size={16} />
              </button>
            </div>
            <p id={descriptionId} className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
            {highlight && <p className={`mt-3 break-words rounded-2xl px-3.5 py-2.5 text-sm font-extrabold ${styles.badge}`}>{highlight}</p>}
          </div>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel} className="btn-secondary min-h-[46px] justify-center disabled:opacity-60">
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
