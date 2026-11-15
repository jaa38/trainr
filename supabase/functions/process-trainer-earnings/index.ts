
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleEarningsProcessorRequest } from "./handler.ts";

Deno.serve((request: Request) =>
  handleEarningsProcessorRequest(request, {
    getExpectedSecret: () =>
      Deno.env.get("TRAINER_EARNINGS_PROCESSOR_SECRET"),

    getSupabaseUrl: () => Deno.env.get("SUPABASE_URL"),

    getServiceRoleKey: () =>
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),

    createClient: (url, key) =>
      createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }),

    randomUUID: () => crypto.randomUUID(),

    logError: (message, detail) => {
      console.error(message, detail ?? "");
    },
  })
);
