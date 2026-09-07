"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  workbenchDropdownItem,
  workbenchDropdownPanel,
  workbenchDropdownTrigger,
} from "@/lib/workbench-ui";

export type WorkbenchSelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: WorkbenchSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  /** Size the control to the longest option label. */
  fitToOptions?: boolean;
};

export function WorkbenchSelect({
  value,
  onChange,
  options,
  placeholder = "Choose…",
  disabled,
  required,
  name,
  id,
  className,
  fitToOptions,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

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
    <div ref={rootRef} className={cn("relative", fitToOptions && "inline-grid", className)}>
      {name || required ? (
        <input type="hidden" name={name} value={value} required={required} />
      ) : null}
      {fitToOptions
        ? options.map((opt) => (
            <span
              key={`size-${opt.value || "empty"}`}
              className="invisible col-start-1 row-start-1 whitespace-nowrap px-3 py-2 pr-8 text-sm"
              aria-hidden
            >
              {opt.label}
            </span>
          ))
        : null}
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          workbenchDropdownTrigger,
          "w-full",
          fitToOptions && "col-start-1 row-start-1 whitespace-nowrap",
        )}
      >
        <span
          className={cn(
            fitToOptions ? "whitespace-nowrap" : "min-w-0 truncate",
            selected ? "text-white" : "text-white/45",
          )}
        >
          {selected?.label || placeholder}
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
        <ul id={listId} role="listbox" className={workbenchDropdownPanel}>
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-white/45">No options</li>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value || "__empty"} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={cn(workbenchDropdownItem, isSelected && "bg-[#1a1a1a]")}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
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
