import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function stripeEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}
function encodeForm(entries: Record<string, string>) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
}
async function stripe(path: string, method: "GET" | "POST", form?: URLSearchParams) {
  const secret = stripeEnv("STRIPE_SECRET_KEY");
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form,
  });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `Stripe request failed (${r.status}).`);
  return data;
}

// One-off admin utility: creates Stripe Products + recurring monthly Prices for
// each paid plan that lacks a stripe_price_id, then links them in the plans table.
export const provisionStripePrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: any = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const isAdmin = (await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" })).data;
    if (!isAdmin) throw new Error("Admins only.");

    const plans = ((await db.from("plans").select("slug,name,price_monthly_cents,stripe_price_id").eq("is_active", true).gt("price_monthly_cents", 0)).data || []) as any[];
    const results: Record<string, string> = {};

    for (const plan of plans) {
      if (plan.stripe_price_id) { results[plan.slug] = `already linked (${plan.stripe_price_id})`; continue; }
      const product = await stripe("products", "POST", encodeForm({
        name: `Stepwise ${plan.name}`,
        "metadata[plan_slug]": plan.slug,
      }));
      const price = await stripe("prices", "POST", encodeForm({
        product: product.id,
        currency: "usd",
        unit_amount: String(plan.price_monthly_cents),
        "recurring[interval]": "month",
        "metadata[plan_slug]": plan.slug,
      }));
      await db.from("plans").update({ stripe_price_id: price.id }).eq("slug", plan.slug);
      results[plan.slug] = price.id;
    }
    return { ok: true, results };
  });
