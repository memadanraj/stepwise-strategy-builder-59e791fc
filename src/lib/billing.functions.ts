import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function paddleEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

type PaddleMethod = "GET" | "POST" | "PATCH";

async function paddle(path: string, method: PaddleMethod, body?: unknown) {
  const apiKey = paddleEnv("PADDLE_API_KEY");
  const environment = process.env["PADDLE_ENVIRONMENT"] === "sandbox" ? "sandbox" : "live";
  const baseUrl = environment === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
  const response = await fetch(`${baseUrl}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Paddle-Version": "1",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.detail || payload?.error?.message || `Paddle request failed (${response.status}).`);
  }
  return payload?.data ?? payload;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function createCheckoutTransaction({
  db,
  userId,
  priceId,
  customData,
}: {
  db: any;
  userId: string;
  priceId: string;
  customData: Record<string, string>;
}) {
  const existingCustomer = (
    await db.from("paddle_customers").select("paddle_customer_id").eq("user_id", userId).maybeSingle()
  ).data;

  const transaction = await paddle("transactions", "POST", {
    ...(existingCustomer?.paddle_customer_id ? { customer_id: existingCustomer.paddle_customer_id } : {}),
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: customData,
  });

  if (!transaction?.id) throw new Error("Paddle did not return a checkout transaction.");
  return transaction.id as string;
}

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ planSlug: z.string().min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = await admin();
    const plan = (
      await db.from("plans").select("slug,name,paddle_price_id,is_active").eq("slug", data.planSlug).maybeSingle()
    ).data;
    if (!plan?.is_active) throw new Error("Plan not found or inactive.");
    if (!plan.paddle_price_id) throw new Error("This plan is not connected to a Paddle Price yet.");

    const transactionId = await createCheckoutTransaction({
      db,
      userId: context.userId,
      priceId: plan.paddle_price_id,
      customData: { user_id: context.userId, plan_slug: plan.slug, type: "subscription" },
    });
    return { ok: true, transactionId };
  });

export const changeSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ planSlug: z.string().min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = await admin();
    const [planResult, currentResult] = await Promise.all([
      db.from("plans").select("slug,paddle_price_id,is_active").eq("slug", data.planSlug).maybeSingle(),
      db.from("paddle_subscriptions").select("paddle_subscription_id,status,plan_slug").eq("user_id", context.userId)
        .in("status", ["active", "trialing", "past_due"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const plan = planResult.data;
    const current = currentResult.data;
    if (!plan?.is_active) throw new Error("Plan not found or inactive.");
    if (!plan.paddle_price_id) throw new Error("This plan is not connected to a Paddle Price yet.");
    if (!current?.paddle_subscription_id) throw new Error("No active subscription found. Use Checkout to start a subscription.");

    const currentPlan = (await db.from("plans").select("paddle_price_id").eq("slug", current.plan_slug).maybeSingle()).data;
    const subscription = await paddle(`subscriptions/${current.paddle_subscription_id}`, "GET");
    const items = Array.isArray(subscription?.items) ? subscription.items : [];
    let selectedIndex = currentPlan?.paddle_price_id
      ? items.findIndex((item: any) => item?.price?.id === currentPlan.paddle_price_id && item?.recurring)
      : -1;
    if (selectedIndex < 0) selectedIndex = items.findIndex((item: any) => item?.recurring);
    if (selectedIndex < 0 || !items[selectedIndex]?.price?.id) throw new Error("Paddle subscription has no billable recurring item.");
    if (items[selectedIndex].price.id === plan.paddle_price_id) return { ok: true, status: subscription.status };

    const nextItems = items.map((item: any, index: number) => ({
      price_id: index === selectedIndex ? plan.paddle_price_id : item.price.id,
      quantity: Number(item.quantity || 1),
    }));
    const updated = await paddle(`subscriptions/${current.paddle_subscription_id}`, "PATCH", {
      items: nextItems,
      proration_billing_mode: "prorated_immediately",
      custom_data: { ...(subscription?.custom_data || {}), user_id: context.userId, plan_slug: plan.slug, type: "subscription" },
    });
    await db.from("paddle_subscriptions").update({
      plan_slug: plan.slug, status: updated.status,
      current_period_start: updated.current_billing_period?.starts_at || null,
      current_period_end: updated.current_billing_period?.ends_at || null,
      cancel_at_period_end: updated.scheduled_change?.action === "cancel",
      canceled_at: updated.canceled_at || null,
      metadata: updated.custom_data || {},
      updated_at: new Date().toISOString(),
    }).eq("paddle_subscription_id", current.paddle_subscription_id);
    await db.from("profiles").update({ plan_slug: plan.slug, updated_at: new Date().toISOString() }).eq("id", context.userId);
    return { ok: true, status: updated.status };
  });

export const createCreditPackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ packSlug: z.string().min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = await admin();
    const pack = (await db.from("credit_packs").select("*").eq("slug", data.packSlug).maybeSingle()).data;
    if (!pack?.is_active) throw new Error("Credit pack not found or inactive.");
    if (!pack.paddle_price_id) throw new Error("This credit pack is not connected to a Paddle Price yet.");
    const transactionId = await createCheckoutTransaction({
      db, userId: context.userId, priceId: pack.paddle_price_id,
      customData: { user_id: context.userId, pack_slug: pack.slug, credits: String(pack.credits), type: "credit_pack" },
    });
    return { ok: true, transactionId };
  });

export const createBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: any = await admin();
    const [customerResult, subscriptionResult] = await Promise.all([
      db.from("paddle_customers").select("paddle_customer_id").eq("user_id", context.userId).maybeSingle(),
      db.from("paddle_subscriptions").select("paddle_subscription_id").eq("user_id", context.userId)
        .in("status", ["active", "trialing", "past_due"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const customer = customerResult.data;
    if (!customer?.paddle_customer_id) throw new Error("No Paddle customer exists yet.");
    const body = subscriptionResult.data?.paddle_subscription_id
      ? { subscription_ids: [subscriptionResult.data.paddle_subscription_id] } : undefined;
    const session = await paddle(`customers/${customer.paddle_customer_id}/portal-sessions`, "POST", body);
    const url = session?.urls?.general?.overview;
    if (!url) throw new Error("Paddle did not return a customer portal URL.");
    return { ok: true, url: url as string };
  });

export const getBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: any = await admin();
    const [customer, subscription, plans, packs] = await Promise.all([
      db.from("paddle_customers").select("*").eq("user_id", context.userId).maybeSingle(),
      db.from("paddle_subscriptions").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("plans").select("slug,name,tagline,price_monthly_cents,monthly_credits,max_projects,max_storage_gb,max_video_minutes,max_resolution,features,is_featured,paddle_price_id").eq("is_active", true).order("sort_order"),
      db.from("credit_packs").select("*").eq("is_active", true).order("sort_order"),
    ]);
    return { customer: customer.data || null, subscription: subscription.data || null, plans: plans.data || [], packs: packs.data || [] };
  });
