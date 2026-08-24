"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type AlertItem = { id: number; message: string };

export default function WebAlertHost() {
  const [queue, setQueue] = useState<AlertItem[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    const nativeAlert = window.alert;
    window.alert = (message?: unknown) => {
      const text = String(message ?? "").trim() || "Đã hoàn tất thao tác.";
      counter.current += 1;
      const id = counter.current;
      setQueue((current) => [...current, { id, message: text }].slice(-4));
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, []);

  const current = queue[0];
  if (!current) return null;

  const close = () => setQueue((items) => items.slice(1));

  return (
    <div
      className="web-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="web-alert-title"
      aria-describedby="web-alert-description"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <div className="web-dialog-panel max-w-md">
        <div className="flex items-start gap-4">
          <span className="web-dialog-icon bg-emerald-50 text-emerald-700 ring-emerald-100">
            <Icon name="check" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">KOSOVOTA</p>
                <h2 id="web-alert-title" className="mt-1 text-lg font-black text-slate-950">Thông báo</h2>
              </div>
              <button type="button" onClick={close} className="icon-button !h-9 !w-9" aria-label="Đóng thông báo">
                <Icon name="x" size={16} />
              </button>
            </div>
            <p id="web-alert-description" className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{current.message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={close} autoFocus className="btn-primary min-w-28 justify-center px-5 py-3 font-black text-white">Đã hiểu</button>
        </div>
      </div>
    </div>
  );
}
