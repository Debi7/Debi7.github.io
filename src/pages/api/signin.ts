import { createClient } from "../../lib/supabase";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createClient({ request, cookies });
  const formData = await request.formData();

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Signed in successfully." }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
