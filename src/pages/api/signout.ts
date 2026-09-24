import { createClient } from "../../lib/supabase";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createClient({ request, cookies });

  const { error } = await supabase.auth.signOut();

  if (error) {
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Signed out." }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
