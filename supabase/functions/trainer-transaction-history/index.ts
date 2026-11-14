import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { handleTrainerTransactionHistory } from "./handler.ts";

export default {
  fetch: withSupabase(
    { auth: "user" },
    (req, ctx) => handleTrainerTransactionHistory(req, ctx),
  ),
};