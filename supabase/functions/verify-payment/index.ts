import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { handleVerifyPayment } from "./handler.ts";

export default {
  fetch: withSupabase(
    { auth: "user" },
    (req, ctx) =>
      handleVerifyPayment(req, ctx, {
        getSecretKey: () => Deno.env.get("PAYSTACK_SECRET_KEY"),
        fetch: globalThis.fetch,
      }),
  ),
};
