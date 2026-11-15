export const BATCH_SIZE = 25;

export type EarningsProcessorResult = {
    processed_count: number;
    retry_count: number;
    dead_letter_count: number;
    recognised_count: number;
    reconciliation_count: number;
};

type SupabaseClientLike = {
    rpc: (
        name: string,
        args: Record<string, unknown>,
    ) => PromiseLike<{
        data: unknown;
        error: { message: string } | null;
    }>;
};

type ProcessorDependencies = {
    getExpectedSecret: () => string | undefined;
    getSupabaseUrl: () => string | undefined;
    getServiceRoleKey: () => string | undefined;
    createClient: (
        url: string,
        key: string,
    ) => SupabaseClientLike;
    randomUUID: () => string;
    logError: (message: string, detail?: string) => void;
};

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, x-processor-secret, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
    body: Record<string, unknown>,
    status = 200,
): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
        },
    });
}

export async function handleEarningsProcessorRequest(
    request: Request,
    dependencies: ProcessorDependencies,
): Promise<Response> {
    if (request.method === "OPTIONS") {
        return new Response("ok", {
            headers: corsHeaders,
        });
    }

    if (request.method !== "POST") {
        return jsonResponse(
            { error: "Method not allowed" },
            405,
        );
    }

    const expectedSecret = dependencies.getExpectedSecret();
    const suppliedSecret = request.headers.get(
        "x-processor-secret",
    );

    if (!expectedSecret || !suppliedSecret) {
        return jsonResponse(
            { error: "Unauthorized" },
            401,
        );
    }

    if (suppliedSecret !== expectedSecret) {
        return jsonResponse(
            { error: "Unauthorized" },
            401,
        );
    }

    const supabaseUrl = dependencies.getSupabaseUrl();
    const serviceRoleKey = dependencies.getServiceRoleKey();

    if (!supabaseUrl || !serviceRoleKey) {
        return jsonResponse(
            { error: "Processor configuration unavailable" },
            500,
        );
    }

    try {
        const supabase = dependencies.createClient(
            supabaseUrl,
            serviceRoleKey,
        );

        const workerId = `earnings-edge-${dependencies.randomUUID()}`;

        const { data, error } = await supabase.rpc(
            "process_trainer_earnings_events",
            {
                p_batch_size: BATCH_SIZE,
                p_worker_id: workerId,
            },
        );

        if (error) {
            dependencies.logError(
                "Earnings processor RPC failed:",
                error.message,
            );

            return jsonResponse(
                { error: "Earnings event processing failed" },
                500,
            );
        }

        const results = data as EarningsProcessorResult[] | null;

        if (
            !Array.isArray(results) ||
            results.length !== 1
        ) {
            dependencies.logError(
                "Unexpected earnings processor response",
            );

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
            dependencies.logError(
                "Invalid earnings processor counters",
            );

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
        dependencies.logError(
            "Unexpected earnings processor error:",
            error instanceof Error ? error.message : "Unknown error",
        );

        return jsonResponse(
            { error: "Unexpected earnings processor failure" },
            500,
        );
    }
}
