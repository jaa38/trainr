import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { handleTrainerPayoutManagement } from "./handler.ts";

export default {
    fetch: withSupabase(
        { auth: "user" },
        (req, ctx) => handleTrainerPayoutManagement(req, ctx),
    ),
};
