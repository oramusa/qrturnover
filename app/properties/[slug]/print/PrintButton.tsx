"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
    >
      Print
    </button>
  );
}
