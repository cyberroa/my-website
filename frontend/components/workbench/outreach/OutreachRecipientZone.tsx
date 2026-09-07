"use client";

import { useState } from "react";
import {
  DRAG_CUSTOMER,
  DRAG_SEGMENT,
  type AudienceState,
  type OutreachCustomer,
  type OutreachSegment,
} from "./types";

type Props = {
  audience: AudienceState;
  onChange: (next: AudienceState) => void;
};

export function OutreachRecipientZone({ audience, onChange }: Props) {
  const [manualInput, setManualInput] = useState("");
  const [dragOver, setDragOver] = useState(false);

  function removeCustomer(id: string) {
    onChange({
      ...audience,
      customers: audience.customers.filter((c) => c.id !== id),
    });
  }

  function removeSegment(id: string) {
    onChange({
      ...audience,
      segments: audience.segments.filter((s) => s.id !== id),
    });
  }

  function removeManual(email: string) {
    onChange({
      ...audience,
      manualEmails: audience.manualEmails.filter((e) => e !== email),
    });
  }

  function addManual() {
    const emails = manualInput
      .split(/[\n,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((e) => e.includes("@"));
    if (emails.length === 0) return;
    const existing = new Set(audience.manualEmails);
    const next = [...audience.manualEmails];
    for (const e of emails) {
      if (!existing.has(e)) {
        existing.add(e);
        next.push(e);
      }
    }
    onChange({ ...audience, manualEmails: next });
    setManualInput("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const custRaw = e.dataTransfer.getData(DRAG_CUSTOMER);
    const segRaw = e.dataTransfer.getData(DRAG_SEGMENT);
    if (custRaw) {
      try {
        const c = JSON.parse(custRaw) as OutreachCustomer;
        if (!audience.customers.some((x) => x.id === c.id)) {
          onChange({ ...audience, customers: [...audience.customers, c] });
        }
      } catch {
        /* ignore */
      }
    }
    if (segRaw) {
      try {
        const s = JSON.parse(segRaw) as OutreachSegment & { member_count?: number };
        if (!audience.segments.some((x) => x.id === s.id)) {
          onChange({
            ...audience,
            segments: [
              ...audience.segments,
              { ...s, member_count: s.member_count ?? 0 },
            ],
          });
        }
      } catch {
        /* ignore */
      }
    }
  }

  const hasAny =
    audience.customers.length > 0 ||
    audience.segments.length > 0 ||
    audience.manualEmails.length > 0;

  return (
    <div className="rounded-xl border border-white/10 bg-background-card p-4">
      <label className="block text-sm">
        <span className="text-text-muted">To</span>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mt-2 min-h-[88px] rounded-md border border-dashed px-3 py-2 ${
            dragOver ? "border-accent-admin bg-accent-admin/5" : "border-white/15 bg-black/30"
          }`}
        >
          {!hasAny ? (
            <p className="text-xs text-text-muted">
              Drag customers or segments here, or add emails below.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {audience.customers.map((c) => (
                <span
                  key={`c-${c.id}`}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-xs"
                >
                  {c.name || c.email}
                  <button
                    type="button"
                    className="text-text-muted hover:text-white"
                    onClick={() => removeCustomer(c.id)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
              {audience.segments.map((s) => (
                <span
                  key={`s-${s.id}`}
                  className="inline-flex items-center gap-1 rounded-full border border-accent-admin/30 bg-accent-admin/10 px-2 py-1 text-xs text-accent-admin"
                >
                  {s.name} ({s.member_count})
                  <button
                    type="button"
                    className="opacity-70 hover:opacity-100"
                    onClick={() => removeSegment(s.id)}
                    aria-label="Remove segment"
                  >
                    ×
                  </button>
                </span>
              ))}
              {audience.manualEmails.map((email) => (
                <span
                  key={`m-${email}`}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-1 font-mono text-xs"
                >
                  {email}
                  <button
                    type="button"
                    className="text-text-muted hover:text-white"
                    onClick={() => removeManual(email)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </label>

      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs"
          placeholder="Add email…"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addManual();
            }
          }}
        />
        <button
          type="button"
          className="rounded-md border border-white/10 px-3 py-2 text-xs"
          onClick={addManual}
        >
          Add
        </button>
      </div>
    </div>
  );
}
