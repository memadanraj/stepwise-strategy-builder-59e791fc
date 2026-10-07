import "@tanstack/react-start/server-only";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}
function hexBytes(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return new Uint8Array();
  const output = new Uint8Array(hex.length / 2);
  for (let index = 0; index < output.length; index += 1) output[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return output;
}
function parseSignature(header: string) {
  const values = new Map<string, string[]>();
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    const existing = values.get(key) || [];
    existing.push(value);
    values.set(key, existing);
  }
  return { timestamp: values.get("ts")?.[0] || "", signatures: values.get("h1") || [] };
}
async function verifySignature(payload: string, header: string, secret: string) {
  const { timestamp, signatures } = parseSignature(header);
  const timestampSeconds = Number(timestamp);
  if (!timestampSeconds || signatures.length === 0 || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signedPayload = new TextEncoder().encode(`${timestamp}:${payload}`);
  for (const signature of signatures) {
    const bytes = hexBytes(signature);
    if (bytes.length > 0 && (await crypto.subtle.verify("HMAC", key, bytes, signedPayload))) return true;
  }
  return false;
}
async function admin() { return (await import("@/integrations/supabase/client.server")).supabaseAdmin; }
async function paddleApi(path: string) {
  const environment = process.env.PADDLE_ENVIRONMENT === "sandbox" ? "sandbox" : "live";
  const baseUrl = environment === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
  const response = await fetch(`${baseUrl}/${path}`, { headers: { Authorization: `Bearer ${env("PADDLE_API_KEY")}`, "Paddle-Version": "1" } });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.detail || payload?.error?.message || "Paddle API request failed.");
  return payload?.data ?? payload;
}
async function addCredits(db: any, userId: string, amount: number, kind: string, description: string) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const profile = (await db.from("profiles").select("credits_balance").eq("id", userId).maybeSingle()).data;
  if (!profile) throw new Error("Profile not found.");
  const next = Math.max(0, Number(profile.credits_balance) + amount);
  await db.from("profiles").update({ credits_balance: next, updated_at: new Date().toISOString() }).eq("id", userId);
  await db.from("credit_transactions").insert({ user_id: userId, amount, kind, description });
}
async function planSlugFromPrice(db: any, priceId: string | undefined) {
  if (!priceId) return null;
  const row = (await db.from("plans").select("slug").eq("paddle_price_id", priceId).maybeSingle()).data;
  return row?.slug || null;
}
async function userIdFromCustomer(db: any, customerId: string | undefined) {
  if (!customerId) return null;
  const row = (await db.from("paddle_customers").select("user_id").eq("paddle_customer_id", customerId).maybeSingle()).data;
  return row?.user_id || null;
}
async function upsertSubscription(db: any, subscription: any) {
  const existing = (await db.from("paddle_subscriptions").select("user_id,plan_slug").eq("paddle_subscription_id", subscription.id).maybeSingle()).data;
  const customData = subscription.custom_data || {};
  const mappedUserId = await userIdFromCustomer(db, subscription.customer_id ? String(subscription.customer_id) : undefined);
  const userId = mappedUserId || existing?.user_id || customData.user_id;
  if (!userId) return;
  const firstRecurringItem = Array.isArray(subscription.items) ? subscription.items.find((item: any) => item?.recurring && item?.price?.id) : undefined;
  const planSlug = (await planSlugFromPrice(db, firstRecurringItem?.price?.id)) || existing?.plan_slug;
  if (!planSlug) return;
  await db.from("paddle_subscriptions").upsert({
    user_id: userId, paddle_customer_id: String(subscription.customer_id || ""), paddle_subscription_id: subscription.id,
    plan_slug: planSlug, status: subscription.status,
    current_period_start: subscription.current_billing_period?.starts_at || null,
    current_period_end: subscription.current_billing_period?.ends_at || null,
    cancel_at_period_end: subscription.scheduled_change?.action === "cancel",
    canceled_at: subscription.canceled_at || null, metadata: customData, updated_at: new Date().toISOString(),
  }, { onConflict: "paddle_subscription_id" });
  await db.from("paddle_customers").upsert({ user_id: userId, paddle_customer_id: String(subscription.customer_id || ""), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (["active", "trialing", "past_due"].includes(subscription.status)) await db.from("profiles").update({ plan_slug: planSlug, updated_at: new Date().toISOString() }).eq("id", userId);
  if (["canceled", "paused"].includes(subscription.status)) await db.from("profiles").update({ plan_slug: "free", updated_at: new Date().toISOString() }).eq("id", userId);
}
export async function handlePaddleWebhook(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("paddle-signature") || "";
  if (!(await verifySignature(payload, signature, env("PADDLE_WEBHOOK_SECRET")))) return new Response("Invalid signature", { status: 400 });
  let event: any;
  try { event = JSON.parse(payload); } catch { return new Response("Invalid JSON", { status: 400 }); }
  const eventId = String(event.event_id || "");
  const eventType = String(event.event_type || "");
  if (!eventId || !eventType || !event.data) return new Response("Invalid Paddle event", { status: 400 });
  const db: any = await admin();
  const seen = await db.from("billing_events").insert({ paddle_event_id: eventId, event_type: eventType, metadata: { occurred_at: event.occurred_at, notification_id: event.notification_id } });
  if (seen.error?.code === "23505") return new Response("ok", { status: 200 });
  if (seen.error) return new Response("Could not record event", { status: 500 });
  try {
    if (eventType === "transaction.completed") {
      const transaction = event.data;
      const customData = transaction.custom_data || {};
      const customerId = transaction.customer_id ? String(transaction.customer_id) : undefined;
      const mappedUserId = await userIdFromCustomer(db, customerId);
      const userId = mappedUserId || customData.user_id;
      const paidPriceId = Array.isArray(transaction.items)
        ? transaction.items.find((item: any) => item?.price?.id)?.price?.id
        : undefined;

      if (userId && customerId && !mappedUserId) {
        await db.from("paddle_customers").upsert({
          user_id: userId,
          paddle_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }

      if (userId && ["api", "web"].includes(transaction.origin)) {
        const pack = paidPriceId
          ? (await db.from("credit_packs").select("slug,credits").eq("paddle_price_id", paidPriceId).maybeSingle()).data
          : null;
        if (pack?.credits) {
          await addCredits(db, userId, Number(pack.credits), "purchase", `Paddle credit pack: ${pack.slug || "unknown"}`);
        }
      }

      if (userId && transaction.subscription_id) {
        const subscription = await paddleApi(`subscriptions/${transaction.subscription_id}`);
        await upsertSubscription(db, subscription);
        const planSlug = await planSlugFromPrice(db, paidPriceId);
        if (planSlug && ["api", "web"].includes(transaction.origin)) {
          const plan = (await db.from("plans").select("monthly_credits").eq("slug", planSlug).maybeSingle()).data;
          if (plan?.monthly_credits) await addCredits(db, userId, Number(plan.monthly_credits), "subscription", `Initial ${planSlug} credits`);
        }
      }

      if (userId && transaction.subscription_id && transaction.origin === "subscription_recurring") {
        const planSlug = await planSlugFromPrice(db, paidPriceId);
        if (planSlug) {
          const plan = (await db.from("plans").select("monthly_credits").eq("slug", planSlug).maybeSingle()).data;
          if (plan?.monthly_credits) await addCredits(db, userId, Number(plan.monthly_credits), "subscription", `Monthly ${planSlug} credits`);
        }
      }
    }
    if (["subscription.activated", "subscription.updated", "subscription.past_due", "subscription.paused", "subscription.resumed"].includes(eventType)) await upsertSubscription(db, event.data);
    if (eventType === "subscription.canceled") {
      const subscription = event.data;
      await upsertSubscription(db, subscription);
      const row = (await db.from("paddle_subscriptions").select("user_id").eq("paddle_subscription_id", subscription.id).maybeSingle()).data;
      if (row?.user_id) await db.from("profiles").update({ plan_slug: "free", updated_at: new Date().toISOString() }).eq("id", row.user_id);
    }
    return new Response("ok", { status: 200 });
  } catch (error: any) {
    await db.from("billing_events").delete().eq("paddle_event_id", eventId);
    return new Response(error?.message || "Webhook processing failed", { status: 500 });
  }
}
