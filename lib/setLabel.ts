import { SupabaseClient } from "@supabase/supabase-js";

// The real set_id (e.g. "SET_004") must stay globally unique — it's the
// literal URL encoded in a physical QR sticker, and property_set_claims uses
// it as the sole lookup key to resolve a scan back to a property. Hosts don't
// need to see that global number though; this computes a per-host ordinal
// ("Set #1", "Set #2", ...) based on when each of their sets was claimed, so
// their own sets look sequential to them regardless of what other hosts have
// claimed in between.
export async function getHostSetNumber(
  supabase: SupabaseClient,
  hostId: string,
  setId: string
): Promise<number | null> {
  const { data } = await supabase
    .from("property_set_claims")
    .select("set_id, claimed_at, properties!inner(host_id)")
    .eq("properties.host_id", hostId)
    .order("claimed_at", { ascending: true });

  if (!data) return null;
  const index = data.findIndex((c) => c.set_id === setId);
  return index === -1 ? null : index + 1;
}
