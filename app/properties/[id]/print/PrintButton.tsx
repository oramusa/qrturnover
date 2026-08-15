"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-black text-white text-sm rounded px-4 py-2"
    >
      Print
    </button>
  );
}
