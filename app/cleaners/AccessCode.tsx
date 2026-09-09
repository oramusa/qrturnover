"use client";

import { useState } from "react";

export default function AccessCode({ code }: { code: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="min-w-16 text-center text-xs font-mono bg-gray-100 text-gray-900 px-2 py-1 rounded"
        aria-label={visible ? `Access code ${code}` : "Access code hidden"}
      >
        {visible ? code : "•••••"}
      </span>
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="text-xs underline text-muted"
      >
        {visible ? "Hide" : "Show"}
      </button>
      <button type="button" onClick={copyCode} className="text-xs underline text-muted">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
