"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type ClickTarget = HTMLElement & { click: () => void };

function isDeleteAction(element: HTMLElement) {
  const text = `${element.textContent || ""} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`.toLowerCase();
  if (/(xóa|xoá)\s+(lọc|tìm kiếm|chữ ký)|clear\s+(filter|search|signature)/i.test(text)) return false;
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

      // Never intercept delete-like buttons that belong to an already-open modal.
      // ConfirmDialog uses role="alertdialog" for danger actions, so checking only
      // role="dialog" caused its own red "Xóa" button to be captured again.
      if (clickable.closest("[data-delete-guard='ignore'], [role='dialog'], [role='alertdialog']")) return;

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
      description="Dữ liệu hệ thống sẽ được lưu vào Thùng rác trước khi xóa để Admin có thể kiểm tra và khôi phục khi cần."
      highlight={target?.textContent?.trim() || "Mục đã chọn"}
      confirmLabel="Chuyển vào thùng rác"
      cancelLabel="Hủy"
      tone="danger"
      onConfirm={confirmDelete}
      onCancel={() => setTarget(null)}
    />
  );
}
