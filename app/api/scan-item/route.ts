import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Public route — cleaners have no auth session. Validates the item actually
// belongs to a zone whose property has this session active, same defense-in-depth
// pattern as /api/scan.
export async function POST(req: NextRequest) {
  const { sessionId, itemId, completed } = await req.json();
  if (!sessionId || !itemId || typeof completed !== "boolean") {
    return NextResponse.json({ error: "Missing sessionId, itemId, or completed" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: item } = await supabase
    .from("zone_checklist_items")
    .select("id, zone_id, zones ( property_id )")
    .eq("id", itemId)
    .single();

  const { data: session } = await supabase
    .from("turnover_sessions")
    .select("id, property_id, status")
    .eq("id", sessionId)
    .single();

  const itemPropertyId = (item?.zones as unknown as { property_id: string } | null)?.property_id;

  if (!item || !session || session.property_id !== itemPropertyId) {
    return NextResponse.json({ error: "Item/session mismatch" }, { status: 400 });
  }
  if (session.status !== "in_progress") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  if (completed) {
    const { error } = await supabase
      .from("scan_item_completions")
      .upsert({ session_id: sessionId, item_id: itemId }, { onConflict: "session_id,item_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("scan_item_completions")
      .delete()
      .eq("session_id", sessionId)
      .eq("item_id", itemId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
