// Runs synchronously during HTML parsing (hard navigations) so client-only
// values (like a viewer's timezone) can correct the DOM before first paint.
// On soft navigations the script doesn't re-run; the owning Client Component
// re-renders with the correct value directly instead.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
