import { query, execute } from "@/lib/db";

// ── Cost calculation ──

const MODEL_RATES: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4.1": { input: 2.00, output: 8.00 },
  "gpt-5": { input: 1.25, output: 10.00 },
  "gpt-5.2": { input: 1.75, output: 14.00 },
  "gpt-5.4": { input: 2.50, output: 15.00 },
};

/** Calculate cost in USD given model + token counts */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rate = MODEL_RATES[model] ?? MODEL_RATES["gpt-4o-mini"];
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}

// ── Record usage ──

export async function recordUsage(
  userId: number,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cost: number,
): Promise<void> {
  await execute(
    `INSERT INTO api_usage (user_id, model, input_tokens, output_tokens, cost, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    userId, model, inputTokens, outputTokens, cost,
  );
}

// ── Aggregation queries ──

type UserUsageSummary = {
  userId: number;
  name: string;
  email: string;
  createdAt: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  callCount: number;
};

export async function getUsersWithUsage(): Promise<UserUsageSummary[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT u.id as user_id, u.name, u.email, u.created_at,
       COALESCE(SUM(a.input_tokens), 0) as total_input_tokens,
       COALESCE(SUM(a.output_tokens), 0) as total_output_tokens,
       COALESCE(SUM(a.cost), 0) as total_cost,
       COUNT(a.id) as call_count
     FROM users u
     LEFT JOIN api_usage a ON a.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC`,
  );
  return rows.map((r) => ({
    userId: r.user_id as number,
    name: r.name as string,
    email: r.email as string,
    createdAt: r.created_at as string,
    totalInputTokens: Number(r.total_input_tokens),
    totalOutputTokens: Number(r.total_output_tokens),
    totalCost: Number(r.total_cost),
    callCount: Number(r.call_count),
  }));
}

type MonthlySummary = {
  month: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  callCount: number;
};

export async function getMonthlySummary(): Promise<MonthlySummary[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT strftime('%Y-%m', created_at) as month,
       SUM(input_tokens) as input_tokens,
       SUM(output_tokens) as output_tokens,
       SUM(cost) as cost,
       COUNT(*) as call_count
     FROM api_usage
     GROUP BY month
     ORDER BY month DESC`,
  );
  return rows.map((r) => ({
    month: r.month as string,
    inputTokens: Number(r.input_tokens),
    outputTokens: Number(r.output_tokens),
    cost: Number(r.cost),
    callCount: Number(r.call_count),
  }));
}
