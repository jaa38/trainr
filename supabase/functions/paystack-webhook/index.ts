import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { handlePaystackWebhook } from "./handler.ts";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Webhook Supabase configuration is missing.");
    return Response.json(
      { error: "Webhook is not configured." },
      { status: 500 },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return await handlePaystackWebhook(req, {
    getSecretKey: () => Deno.env.get("PAYSTACK_SECRET_KEY"),
    processEvent: async (event) => {
      const { data, error } = await admin.rpc(
        "process_paystack_webhook_event",
        {
          p_event_key: event.eventKey,
          p_event_type: event.eventType,
          p_provider_reference: event.reference,
          p_amount_kobo: event.amountKobo,
          p_currency: event.currency,
          p_provider_status: event.providerStatus,
        },
      );

      return { data, error };
    },
  });
});
