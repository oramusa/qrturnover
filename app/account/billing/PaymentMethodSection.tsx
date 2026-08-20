"use client";

import { useState } from "react";
import UpdatePaymentMethodForm from "./UpdatePaymentMethodForm";

export default function PaymentMethodSection({
  brand,
  last4,
  expMonth,
  expYear,
}: {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500">Payment method</p>
          {brand && last4 ? (
            <p className="text-sm mt-1 capitalize">
              {brand} •••• {last4}
              {expMonth && expYear && (
                <span className="text-gray-400">
                  {" "}
                  — expires {String(expMonth).padStart(2, "0")}/{expYear}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm mt-1 text-gray-500">No card on file</p>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm border rounded px-3 py-2 hover:bg-gray-50 hover:text-gray-900 shrink-0"
          >
            {brand ? "Update card" : "Add card"}
          </button>
        )}
      </div>
      {editing && <UpdatePaymentMethodForm onDone={() => setEditing(false)} />}
    </div>
  );
}
