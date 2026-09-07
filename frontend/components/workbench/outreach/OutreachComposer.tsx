"use client";

import { MERGE_VARIABLES, type OutreachPreview, type OutreachTemplate } from "./types";
import { WorkbenchSelect } from "@/components/workbench/WorkbenchSelect";

type Props = {
  templates: OutreachTemplate[];
  templateId: string;
  subject: string;
  bodyMd: string;
  busy: boolean;
  preview: OutreachPreview | null;
  onTemplateId: (id: string) => void;
  onSubject: (v: string) => void;
  onBodyMd: (v: string) => void;
  onPreview: () => void;
  onSend: () => void;
  canSend: boolean;
};

export function OutreachComposer({
  templates,
  templateId,
  subject,
  bodyMd,
  busy,
  preview,
  onTemplateId,
  onSubject,
  onBodyMd,
  onPreview,
  onSend,
  canSend,
}: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-background-card p-4">
      <label className="block text-sm">
        <span className="text-text-muted">Template</span>
        <WorkbenchSelect
          className="mt-1"
          value={templateId}
          onChange={onTemplateId}
          placeholder="Start blank"
          options={[
            { value: "", label: "Start blank" },
            ...templates.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
      </label>

      <label className="block text-sm">
        <span className="text-text-muted">Subject</span>
        <input
          required
          className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          value={subject}
          onChange={(e) => onSubject(e.target.value)}
        />
      </label>

      <label className="block text-sm">
        <span className="text-text-muted">Message</span>
        <textarea
          required
          className="mt-1 min-h-[200px] w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          value={bodyMd}
          onChange={(e) => onBodyMd(e.target.value)}
        />
      </label>

      <p className="text-xs text-text-muted">
        Merge fields:{" "}
        {MERGE_VARIABLES.map((v) => (
          <code key={v} className="mr-2">{`{{ ${v} }}`}</code>
        ))}
      </p>

      {preview ? (
        <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-sm">
          <p className="text-xs text-text-muted">
            Preview for {preview.sample_name || preview.sample_email} · {preview.recipient_count}{" "}
            recipient(s)
          </p>
          <p className="mt-2 font-medium">{preview.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-text-muted">{preview.text}</pre>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canSend || busy}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-40"
          onClick={onPreview}
        >
          {busy ? "Working…" : "Preview"}
        </button>
        <button
          type="button"
          disabled={!canSend || busy}
          className="rounded-lg bg-accent-admin px-6 py-2 text-sm font-semibold text-black disabled:opacity-40"
          onClick={onSend}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
