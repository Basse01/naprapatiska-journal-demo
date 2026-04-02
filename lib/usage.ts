const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const CLINIC_ID = process.env.CLINIC_ID!;

// Deepgram pricing: $0.0043 per minute (Nova-2)
const DEEPGRAM_COST_PER_SECOND = 0.0043 / 60;

// Azure OpenAI gpt-4o pricing per token
const AZURE_INPUT_COST_PER_TOKEN = 2.50 / 1_000_000;
const AZURE_OUTPUT_COST_PER_TOKEN = 10.00 / 1_000_000;

export async function logDeepgramUsage(audioSeconds: number) {
  const cost = audioSeconds * DEEPGRAM_COST_PER_SECOND;
  await insertLog("deepgram", audioSeconds, 0, cost);
}

export async function logAzureUsage(inputTokens: number, outputTokens: number) {
  const cost = (inputTokens * AZURE_INPUT_COST_PER_TOKEN) + (outputTokens * AZURE_OUTPUT_COST_PER_TOKEN);
  await insertLog("azure-openai", inputTokens, outputTokens, cost);
}

async function insertLog(service: string, inputUnits: number, outputUnits: number, estimatedCost: number) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/clinic_usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        clinic_id: CLINIC_ID,
        service,
        input_units: inputUnits,
        output_units: outputUnits,
        estimated_cost_usd: estimatedCost,
      }),
    });
  } catch (error) {
    console.error("Usage logging failed:", error);
  }
}
