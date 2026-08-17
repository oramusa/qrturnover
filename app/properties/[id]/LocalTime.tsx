"use client";

import { useId } from "react";
import { InlineScript } from "@/app/components/InlineScript";

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

// Scan times are recorded in UTC but should read in the viewer's own timezone,
// not the server's. Renders the server's formatting first, then an inline
// script corrects it before paint on hard navigations; on soft navigations
// this component's own client render already has the right value.
export default function LocalTime({
  iso,
  options = DEFAULT_OPTIONS,
}: {
  iso: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const id = useId();

  return (
    <>
      <time id={id} dateTime={iso} suppressHydrationWarning>
        {new Date(iso).toLocaleString([], options)}
      </time>
      <InlineScript
        html={`{var n=document.getElementById(${JSON.stringify(id)});if(n)n.textContent=new Date(${JSON.stringify(iso)}).toLocaleString([],${JSON.stringify(options)})}`}
      />
    </>
  );
}
