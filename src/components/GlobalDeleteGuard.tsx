"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type ClickTarget = HTMLElement & { click: () => void };

function isDeleteAction(element: HTMLElement) {
  const text = `${element.textContent || ""} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`.toLowerCase();
  return /(^|\s)(xóa|xoá|delete|remove)(\s|$)/i.test(text);
}

export default function GlobalDeleteGuard() {
  const [target, setTarget] = useState<ClickTarget | null>(null);
  const bypass = useRef(new WeakSet<HTMLElement>());

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const raw = event.target;
      if (!(raw instanceof Element)) return;
      const clickable = raw.closest("button,a,[role='button']") as ClickTarget | null;
      if (!clickable || !isDeleteAction(clickable)) return;
      if (clickable.closest("[role='dialog']")) return;
      if (bypass.current.has(clickable)) {
        bypass.current.delete(clickable);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setTarget(clickable);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  function confirmDelete() {
    if (!target) return;
    const element = target;
    setTarget(null);
    bypass.current.add(element);

    const previousConfirm = window.confirm;
    window.confirm = () => true;
    try {
      element.click();
    } finally {
      window.confirm = previousConfirm;
    }
  }

  return (
    <ConfirmDialog
      open={Boolean(target)}
      title="Xác nhận xóa"
      description="Hành động này có thể làm mất dữ liệu hoặc liên kết đang sử dụng. Hãy kiểm tra trước khi tiếp tục."
      highlight={target?.textContent?.trim() || "Mục đã chọn"}
      confirmLabel="Xóa"
      cancelLabel="Hủy"
      tone="danger"
      onConfirm={confirmDelete}
      onCancel={() => setTarget(null)}
    />
  );
}
