import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, x-processor-secret, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BATCH_SIZE = 25;

type EarningsProcessorResult = {
    processed_count: number;
    retry_count: number;
    dead_letter_count: number;
    recognised_count: number;
    reconciliation_count: number;
};

function jsonResponse(
    body: Record<string, unknown>,
    status = 200,
) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
        },
    });
}

Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const expectedSecret = Deno.env.get(
        "TRAINER_EARNINGS_PROCESSOR_SECRET",
    );

    const suppliedSecret = request.headers.get("x-processor-secret");

    if (!expectedSecret || !suppliedSecret) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    if (suppliedSecret !== expectedSecret) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
        return jsonResponse(
            { error: "Processor configuration unavailable" },
            500,
        );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    const workerId = `earnings-edge-${crypto.randomUUID()}`;

    try {
        const { data, error } = await supabase.rpc(
            "process_trainer_earnings_events",
            {
                p_batch_size: BATCH_SIZE,
                p_worker_id: workerId,
            },
        );

        if (error) {
            console.error("Earnings processor RPC failed:", error.message);

            return jsonResponse(
                { error: "Earnings event processing failed" },
                500,
            );
        }

        const results = data as EarningsProcessorResult[] | null;

        if (!Array.isArray(results) || results.length !== 1) {
            console.error("Unexpected earnings processor response");

            return jsonResponse(
                { error: "Unexpected processor response" },
                500,
            );
        }

        const result = results[0];

        const counters = [
            result.processed_count,
            result.retry_count,
            result.dead_letter_count,
            result.recognised_count,
            result.reconciliation_count,
        ];

        if (
            counters.some(
                (value) => !Number.isInteger(value) || value < 0,
            )
        ) {
            console.error("Invalid earnings processor counters");

            return jsonResponse(
                { error: "Invalid processor response" },
                500,
            );
        }

        return jsonResponse({
            success: true,
            workerId,
            batchSize: BATCH_SIZE,
            results: result,
        });
    } catch (error) {
        console.error(
            "Unexpected earnings processor error:",
            error instanceof Error ? error.message : "Unknown error",
        );

        return jsonResponse(
            { error: "Unexpected earnings processor failure" },
            500,
        );
    }
});
