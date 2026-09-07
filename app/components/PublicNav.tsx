import { createClient } from "@/lib/supabase/server";
import AppNav from "./AppNav";

// Shown at the top of public pages (Privacy, Terms, Blog, Contact) that
// anyone can reach, logged in or not. AppNav's links all require auth, so we
// only render it for a signed-in visitor — an anonymous one just sees each
// page's own "back" link instead.
export default async function PublicNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return <AppNav />;
}
