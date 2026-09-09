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
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className="min-w-24 text-center text-sm tracking-[0.2em] font-mono bg-gray-900 text-white border border-gray-700 px-3 py-2 rounded-lg"
        aria-label={visible ? `Access code ${code}` : "Access code hidden"}
      >
        {visible ? code : "•••••"}
      </span>
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="text-xs font-medium border border-gray-700 rounded-lg px-3 py-2 hover:border-gray-500"
      >
        {visible ? "Hide" : "Show"}
      </button>
      <button type="button" onClick={copyCode} className="text-xs font-medium text-green-400 px-2 py-2 hover:text-green-300">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
