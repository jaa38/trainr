import { assertEquals } from "jsr:@std/assert@^1";
import { handleEarningsProcessorRequest } from "./handler.ts";

const PROCESSOR_SECRET = "test-processor-secret";
const SUPABASE_URL = "https://example.supabase.co";
const SERVICE_ROLE_KEY = "test-service-role-key";

const validResult = {
    processed_count: 2,
    retry_count: 0,
    dead_letter_count: 0,
    recognised_count: 2,
    reconciliation_count: 0,
};

function makeRequest(
    method = "POST",
    secret?: string,
): Request {
    const headers = new Headers();

    if (secret !== undefined) {
        headers.set("x-processor-secret", secret);
    }

    return new Request(
        "https://example.test/process-trainer-earnings",
        { method, headers },
    );
}

function makeDependencies(options: {
    expectedSecret?: string;
    supabaseUrl?: string;
    serviceRoleKey?: string;
    rpcData?: unknown;
    rpcError?: { message: string } | null;
    createClientError?: Error;
    rpcErrorThrown?: Error;
} = {}) {
    const calls = {
        createClient: 0,
        rpc: 0,
        rpcName: "",
        rpcArgs: null as Record<string, unknown> | null,
        logs: [] as string[],
    };

    const dependencies = {
        getExpectedSecret: () => options.expectedSecret ?? PROCESSOR_SECRET,

        getSupabaseUrl: () => options.supabaseUrl ?? SUPABASE_URL,

        getServiceRoleKey: () => options.serviceRoleKey ?? SERVICE_ROLE_KEY,

        createClient: (url: string, key: string) => {
            calls.createClient++;

            assertEquals(url, SUPABASE_URL);
            assertEquals(key, SERVICE_ROLE_KEY);

            if (options.createClientError) {
                throw options.createClientError;
            }

            return {
                rpc: async (
                    name: string,
                    args: Record<string, unknown>,
                ) => {
                    calls.rpc++;
                    calls.rpcName = name;
                    calls.rpcArgs = args;

                    if (options.rpcErrorThrown) {
                        throw options.rpcErrorThrown;
                    }

                    return {
                        data: options.rpcData === undefined
                            ? [validResult]
                            : options.rpcData,
                        error: options.rpcError ?? null,
                    };
                },
            };
        },

        randomUUID: () => "test-worker-id",

        logError: (message: string, detail?: string) => {
            calls.logs.push(`${message} ${detail ?? ""}`);
        },
    };

    return { dependencies, calls };
}

Deno.test("accepts OPTIONS requests without calling Supabase", async () => {
    const { dependencies, calls } = makeDependencies();

    const response = await handleEarningsProcessorRequest(
        makeRequest("OPTIONS"),
        dependencies,
    );

    assertEquals(response.status, 200);
    assertEquals(await response.text(), "ok");
    assertEquals(calls.createClient, 0);
    assertEquals(calls.rpc, 0);
});

Deno.test("rejects methods other than POST", async () => {
    const { dependencies, calls } = makeDependencies();

    const response = await handleEarningsProcessorRequest(
        makeRequest("GET"),
        dependencies,
    );

    assertEquals(response.status, 405);
    assertEquals(calls.createClient, 0);
    assertEquals(calls.rpc, 0);
});

Deno.test("rejects a missing processor secret", async () => {
    const { dependencies, calls } = makeDependencies();

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST"),
        dependencies,
    );

    assertEquals(response.status, 401);
    assertEquals(calls.createClient, 0);
});

Deno.test("rejects an incorrect processor secret", async () => {
    const { dependencies, calls } = makeDependencies();

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", "incorrect-secret"),
        dependencies,
    );

    assertEquals(response.status, 401);
    assertEquals(calls.createClient, 0);
    assertEquals(calls.rpc, 0);
});

Deno.test("rejects a missing expected processor secret", async () => {
    const { dependencies, calls } = makeDependencies({
        expectedSecret: "",
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 401);
    assertEquals(calls.createClient, 0);
});

Deno.test("rejects missing Supabase URL configuration", async () => {
    const { dependencies, calls } = makeDependencies({
        supabaseUrl: "",
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 500);
    assertEquals(calls.createClient, 0);
});

Deno.test("rejects missing service role configuration", async () => {
    const { dependencies, calls } = makeDependencies({
        serviceRoleKey: "",
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 500);
    assertEquals(calls.createClient, 0);
});

Deno.test("calls the earnings processor RPC with the correct arguments", async () => {
    const { dependencies, calls } = makeDependencies();

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 200);
    assertEquals(calls.createClient, 1);
    assertEquals(calls.rpc, 1);
    assertEquals(
        calls.rpcName,
        "process_trainer_earnings_events",
    );
    assertEquals(calls.rpcArgs, {
        p_batch_size: 25,
        p_worker_id: "earnings-edge-test-worker-id",
    });

    const body = await response.json();

    assertEquals(body.success, true);
    assertEquals(body.workerId, "earnings-edge-test-worker-id");
    assertEquals(body.batchSize, 25);
    assertEquals(body.results, validResult);
});

Deno.test("returns 500 when the RPC reports an error", async () => {
    const { dependencies, calls } = makeDependencies({
        rpcError: { message: "Database unavailable" },
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 500);
    assertEquals(calls.rpc, 1);
    assertEquals(calls.logs.length, 1);
});

Deno.test("rejects a null RPC result", async () => {
    const { dependencies } = makeDependencies({
        rpcData: null,
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 500);
});

Deno.test("rejects an empty RPC result", async () => {
    const { dependencies } = makeDependencies({
        rpcData: [],
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 500);
});

Deno.test("rejects multiple RPC result rows", async () => {
    const { dependencies } = makeDependencies({
        rpcData: [validResult, validResult],
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 500);
});

Deno.test("rejects negative processor counters", async () => {
    const { dependencies } = makeDependencies({
        rpcData: [{
            ...validResult,
            retry_count: -1,
        }],
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 500);
});

Deno.test("rejects non-integer processor counters", async () => {
    const { dependencies } = makeDependencies({
        rpcData: [{
            ...validResult,
            processed_count: 1.5,
        }],
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 500);
});

Deno.test("rejects missing processor counters", async () => {
    const { dependencies } = makeDependencies({
        rpcData: [{
            processed_count: 1,
            retry_count: 0,
            dead_letter_count: 0,
            recognised_count: 1,
        }],
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 500);
});

Deno.test("returns 500 when the RPC throws unexpectedly", async () => {
    const { dependencies, calls } = makeDependencies({
        rpcErrorThrown: new Error("Unexpected RPC failure"),
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 500);
    assertEquals(calls.rpc, 1);
    assertEquals(calls.logs.length, 1);
});

Deno.test("returns 500 when Supabase client initialisation fails", async () => {
    const { dependencies, calls } = makeDependencies({
        createClientError: new Error("Supabase client initialisation failed"),
    });

    const response = await handleEarningsProcessorRequest(
        makeRequest("POST", PROCESSOR_SECRET),
        dependencies,
    );

    assertEquals(response.status, 500);
    assertEquals(calls.createClient, 1);
    assertEquals(calls.rpc, 0);
    assertEquals(calls.logs.length, 1);
});
