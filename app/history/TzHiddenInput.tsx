"use client";

import { useEffect, useRef } from "react";

// Carries the viewer's IANA timezone into the filter form's GET submission,
// so date-range filters can be interpreted as local calendar days instead of
// UTC. A hidden field has no visual flash risk, so (unlike LocalTime) a
// plain ref + effect is simpler and more reliable than an inline script.
export default function TzHiddenInput({ defaultValue }: { defaultValue: string }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  }, []);

  return <input type="hidden" name="tz" ref={ref} defaultValue={defaultValue} />;
}
