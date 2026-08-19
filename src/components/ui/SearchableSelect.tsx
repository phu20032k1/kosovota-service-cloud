"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export type SearchableOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  emptyText?: string;
  disabled?: boolean;
};

function searchable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function SearchableSelect({ value, onChange, options, placeholder, emptyText = "Không tìm thấy dữ liệu phù hợp", disabled = false }: Props) {
  const selected = useMemo(() => options.find((option) => option.value === value) || null, [options, value]);
  const [query, setQuery] = useState(selected?.label || "");
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) setQuery(selected?.label || "");
  }, [selected, open]);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  const filtered = useMemo(() => {
    const needle = searchable(query);
    if (!needle || (selected && query === selected.label)) return options.slice(0, 20);
    return options
      .filter((option) => searchable(`${option.label} ${option.description || ""} ${option.searchText || ""}`).includes(needle))
      .slice(0, 30);
  }, [options, query, selected]);

  function choose(option: SearchableOption) {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Icon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className="pr-10 pl-10"
          autoComplete="off"
          onFocus={(event) => {
            if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
            setOpen(true);
            event.currentTarget.select();
          }}
          onBlur={() => {
            closeTimer.current = window.setTimeout(() => {
              setOpen(false);
              setQuery(selected?.label || "");
            }, 150);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (value && event.target.value !== selected?.label) onChange("");
          }}
        />
        {(value || query) && !disabled && (
          <button
            type="button"
            aria-label="Xóa lựa chọn"
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => { onChange(""); setQuery(""); setOpen(true); }}
          >
            <Icon name="x" size={15} />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-[80] mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`block w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-emerald-50 ${option.value === value ? "bg-emerald-50" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              <span className="block text-sm font-bold text-slate-900">{option.label}</span>
              {option.description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{option.description}</span>}
            </button>
          ))}
          {!filtered.length && <p className="px-3 py-5 text-center text-sm text-slate-500">{emptyText}</p>}
        </div>
      )}
    </div>
  );
}
