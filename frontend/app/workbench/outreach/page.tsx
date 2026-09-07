"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkbenchPageHeader } from "@/components/ui";
import { OutreachComposer } from "@/components/workbench/outreach/OutreachComposer";
import { OutreachRecipientZone } from "@/components/workbench/outreach/OutreachRecipientZone";
import { OutreachSourcePanel } from "@/components/workbench/outreach/OutreachSourcePanel";
import type {
  AudienceState,
  OutreachPreview,
  OutreachSegment,
  OutreachTemplate,
} from "@/components/workbench/outreach/types";
import { ApiError } from "@/lib/api";
import { apiFetchWithAuth } from "@/lib/api-workbench";
import { createClient } from "@/lib/supabase/client";

const emptyAudience: AudienceState = {
  customers: [],
  segments: [],
  manualEmails: [],
};

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function OutreachPage() {
  const [token, setToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [segmentFilter, setSegmentFilter] = useState<OutreachSegment | null>(null);
  const [audience, setAudience] = useState<AudienceState>(emptyAudience);
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<OutreachPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
      if (session?.access_token) {
        void apiFetchWithAuth<OutreachTemplate[]>(
          "/api/v1/workbench/templates",
          session.access_token,
        ).then(setTemplates);
      }
    });
  }, []);

  const selectedCustomerIds = useMemo(
    () => new Set(audience.customers.map((c) => c.id)),
    [audience.customers],
  );

  const payload = useCallback(
    () => ({
      customer_ids: audience.customers.map((c) => c.id),
      segment_ids: audience.segments.map((s) => s.id),
      recipients: audience.manualEmails,
      subject: subject.trim(),
      body_md: bodyMd.trim(),
    }),
    [audience, subject, bodyMd],
  );

  const canSend =
    Boolean(token) &&
    subject.trim().length > 0 &&
    bodyMd.trim().length > 0 &&
    (audience.customers.length > 0 ||
      audience.segments.length > 0 ||
      audience.manualEmails.length > 0);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setBodyMd(tpl.body_md);
    }
    setPreview(null);
  }

  async function addSegmentWithCount(seg: OutreachSegment & { member_count?: number }) {
    let member_count = seg.member_count ?? 0;
    if (token && member_count === 0) {
      try {
        const prev = await apiFetchWithAuth<{ count: number }>(
          `/api/v1/workbench/segments/${seg.id}/preview`,
          token,
          { method: "POST" },
        );
        member_count = prev.count;
      } catch {
        /* keep 0 */
      }
    }
    setAudience((a) => {
      if (a.segments.some((s) => s.id === seg.id)) return a;
      return {
        ...a,
        segments: [...a.segments, { ...seg, member_count }],
      };
    });
    setPreview(null);
  }

  async function runPreview() {
    if (!token || !canSend) return;
    setBusy(true);
    setError(null);
    try {
      const out = await apiFetchWithAuth<OutreachPreview>(
        "/api/v1/workbench/outreach/preview",
        token,
        { method: "POST", body: JSON.stringify(payload()) },
      );
      setPreview(out);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!token || !canSend) return;
    if (!confirm("Send this outreach now?")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const out = await apiFetchWithAuth<{
        sent: number;
        skipped_suppressed?: number;
        failed?: number;
        audience_total?: number;
      }>("/api/v1/workbench/outreach/send", token, {
        method: "POST",
        body: JSON.stringify({ ...payload(), template_id: templateId || null }),
      });
      const parts = [`Sent to ${out.sent} of ${out.audience_total ?? "?"} recipient(s)`];
      if (out.skipped_suppressed) parts.push(`${out.skipped_suppressed} skipped (suppressed)`);
      if (out.failed) parts.push(`${out.failed} failed`);
      setMessage(parts.join(" · "));
      setPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.body ?? err.message) : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <WorkbenchPageHeader
        eyebrow="Email"
        title="Outreach"
        description={
          <>
            <p>
              Compose a quick personalized email: search customers and segments, pick a template,
              customize the message, and send with merge fields like{" "}
              <code>{`{{ first_name }}`}</code>.
            </p>
            <p className="text-sm text-text-muted">
              For tracked bulk sends with open/click stats, use{" "}
              <Link href="/workbench/campaigns" className="text-accent-admin underline">
                Campaigns
              </Link>
              .
            </p>
          </>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-text-muted">Search customers &amp; segments</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, company, email, website, segment…"
            />
          </label>
          <OutreachSourcePanel
            token={token}
            search={debouncedSearch}
            segmentFilter={segmentFilter}
            onAddCustomer={(c) => {
              setAudience((a) =>
                a.customers.some((x) => x.id === c.id)
                  ? a
                  : { ...a, customers: [...a.customers, c] },
              );
              setPreview(null);
            }}
            onAddSegment={(s) => void addSegmentWithCount(s)}
            onFilterSegment={setSegmentFilter}
            selectedCustomerIds={selectedCustomerIds}
          />
        </div>

        <div className="space-y-4">
          <OutreachRecipientZone audience={audience} onChange={setAudience} />
          <OutreachComposer
            templates={templates}
            templateId={templateId}
            subject={subject}
            bodyMd={bodyMd}
            busy={busy}
            preview={preview}
            onTemplateId={applyTemplate}
            onSubject={(v) => {
              setSubject(v);
              setPreview(null);
            }}
            onBodyMd={(v) => {
              setBodyMd(v);
              setPreview(null);
            }}
            onPreview={() => void runPreview()}
            onSend={() => void send()}
            canSend={canSend}
          />
        </div>
      </div>

      {error ? (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}
    </>
  );
}
