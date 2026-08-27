type HostAddress = {
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
};

export function hasMailingAddress(host: HostAddress | null | undefined): boolean {
  return !!host?.address_line?.trim();
}

export function formatMailingAddress(host: HostAddress | null | undefined): string {
  if (!hasMailingAddress(host)) return "(not provided yet)";
  const cityStateZip = [host!.city, host!.state].filter((v) => v?.trim()).join(", ");
  const lines = [
    host!.address_line!.trim(),
    [cityStateZip, host!.zip_code?.trim()].filter(Boolean).join(" "),
    host!.country?.trim(),
  ].filter((line) => line && line.trim().length > 0);
  return lines.join("\n  ");
}
