// OAuth callback: Google redirects here with a `code`; we exchange it for a
// session cookie, then send the user back where they started.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await supabaseServer();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      // Land on /account, which reads sessionStorage("pobi.authNext") and
      // bounces to wherever the user started (or stays to confirm sign-in).
      if (!error) return NextResponse.redirect(`${origin}/account`);
    }
  }
  return NextResponse.redirect(`${origin}/account?auth_error=1`);
}
