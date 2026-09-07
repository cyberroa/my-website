"use client";

import { useState, useRef, useEffect } from "react";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([
    { role: "bot", text: "Hi! What can I help you with today?" },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function replyFor(text: string) {
    const t = text.toLowerCase();
    if (t.includes("hours")) return "Our office hours are 9am–5pm EST.";
    if (t.includes("contact")) return "You can reach us at (904) 742-6265 or info@test.com.";
    return "I'm not sure about that. Please contact support for more info.";
  }

  function send() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    setMessages((m) => [
      ...m,
      { role: "user", text: trimmed },
      { role: "bot", text: replyFor(trimmed) },
    ]);
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent-ice text-xl text-black shadow-lg shadow-accent-ice/40 transition hover:brightness-110"
        aria-label="Open chat"
        onClick={() => setOpen((o) => !o)}
      >
        💬
      </button>

      {open ? (
        <div className="fixed bottom-24 right-5 z-40 flex max-h-[min(420px,70vh)] w-[min(320px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-white/10 bg-background-raised shadow-xl">
          <div className="flex items-center justify-between bg-accent-ice px-3 py-2 font-semibold text-black">
            <span>Chat</span>
            <button
              type="button"
              className="text-lg leading-none"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="max-h-64 flex-1 space-y-2 overflow-y-auto p-3 text-sm text-text-secondary">
            {messages.map((msg, i) => (
              <p key={i}>
                {msg.role === "user" ? (
                  <>
                    <strong className="text-white">You:</strong> {msg.text}
                  </>
                ) : (
                  <>
                    <strong className="text-accent-ice">Assistant:</strong> {msg.text}
                  </>
                )}
              </p>
            ))}
            <div ref={bottomRef} />
          </div>
          <input
            className="border-t border-white/10 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-text-muted"
            placeholder="Type your question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
        </div>
      ) : null}
    </>
  );
}
