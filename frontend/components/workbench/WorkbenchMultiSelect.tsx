"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  workbenchDropdownItem,
  workbenchDropdownPanel,
  workbenchDropdownTrigger,
} from "@/lib/workbench-ui";
import type { WorkbenchSelectOption } from "@/components/workbench/WorkbenchSelect";

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  options: WorkbenchSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function WorkbenchMultiSelect({
  values,
  onChange,
  options,
  placeholder = "Any",
  disabled,
  className,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.filter((o) => values.includes(o.value));
  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].label
        : `${selected.length} selected`;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(workbenchDropdownTrigger, "w-full")}
      >
        <span className={cn("min-w-0 truncate", selected.length ? "text-white" : "text-white/45")}>
          {label}
        </span>
        <svg
          viewBox="0 0 12 12"
          className={cn("h-3 w-3 shrink-0 opacity-60 transition-transform", open && "rotate-180")}
          aria-hidden
        >
          <path fill="currentColor" d="M2.2 4.2 6 8l3.8-3.8-.9-.9L6 6.2 3.1 3.3z" />
        </svg>
      </button>
      {open && !disabled ? (
        <ul id={listId} role="listbox" aria-multiselectable className={workbenchDropdownPanel}>
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-white/45">No options</li>
          ) : (
            options.map((opt) => {
              const isSelected = values.includes(opt.value);
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={cn(workbenchDropdownItem, isSelected && "bg-[#1a1a1a]")}
                    onClick={() => {
                      onChange(
                        isSelected
                          ? values.filter((v) => v !== opt.value)
                          : [...values, opt.value],
                      );
                    }}
                  >
                    <span className="mr-2 inline-block w-3 text-accent-admin">
                      {isSelected ? "✓" : ""}
                    </span>
                    {opt.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
