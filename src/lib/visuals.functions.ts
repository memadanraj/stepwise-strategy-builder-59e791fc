import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { VISUAL_STYLES, type VisualStyle } from "./visual-styles";

const VIDEO_GATEWAY = "https://ai.gateway.lovable.dev/v1";

function videoGatewayHeaders(apiKey: string, json = true) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${apiKey}`,
    "Lovable-API-Key": apiKey,
    "X-Lovable-AIG-SDK": "tanstack-ai",
  };
}

function gatewayErrorMessage(status: number, body: string, fallback: string) {
  let detail = "";
  try {
    const json = JSON.parse(body);
    detail = json?.error?.message ?? json?.message ?? json?.detail ?? "";
  } catch {
    detail = body.slice(0, 240);
  }
  if (status === 429) return "AI is busy right now. Please try again shortly.";
  if (status === 402) return "AI credits for this workspace are exhausted.";
  return detail ? `${fallback} (${detail})` : `${fallback} (${status}).`;
}

function clipSeconds(duration: number): "4" | "6" | "8" {
  if (duration <= 5) return "4";
  if (duration <= 7) return "6";
  return "8";
}

async function fetchMediaBytes(url: string, apiKey: string): Promise<Uint8Array | null> {
  for (const headers of [
    {},
    { Authorization: `Bearer ${apiKey}`, "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "tanstack-ai" },
  ]) {
    const res = await fetch(url, { headers });
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
  }
  return null;
}

async function downloadVideoContent(jobId: string, apiKey: string): Promise<Uint8Array> {
  const res = await fetch(`${VIDEO_GATEWAY}/videos/${encodeURIComponent(jobId)}/content`, {
    headers: videoGatewayHeaders(apiKey, false),
  });
  if (!res.ok) {
    throw new Error(gatewayErrorMessage(res.status, await res.text().catch(() => ""), "The generated clip could not be downloaded"));
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function generateSceneClipBytes(apiKey: string, model: string, prompt: string, duration: number, vertical: boolean): Promise<Uint8Array> {
  const start = await fetch(`${VIDEO_GATEWAY}/videos`, {
    method: "POST",
    headers: videoGatewayHeaders(apiKey),
    body: JSON.stringify({
      model,
      prompt,
      size: vertical ? "720x1280" : "1280x720",
      seconds: clipSeconds(duration),
    }),
  });

  if (!start.ok) {
    throw new Error(gatewayErrorMessage(start.status, await start.text().catch(() => ""), "Clip generation failed to start"));
  }

  const job = await start.json();
  const id = job?.id as string | undefined;
  if (!id) throw new Error("Clip generation failed to start: gateway returned no job ID.");

  const deadline = Date.now() + 10 * 60 * 1000;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const poll = await fetch(`${VIDEO_GATEWAY}/videos/${encodeURIComponent(id)}`, {
      headers: videoGatewayHeaders(apiKey, false),
    });
    const info = await poll.json().catch(() => ({}));
    if (!poll.ok) {
      throw new Error(gatewayErrorMessage(poll.status, JSON.stringify(info), "Clip status check failed"));
    }

    if (info.status === "completed" || info.status === "succeeded") {
      const url = info.url ?? info.video_url ?? info.video?.url ?? info.output?.url;
      if (url) {
        const bytes = await fetchMediaBytes(url, apiKey);
        if (bytes) return bytes;
      }
      return downloadVideoContent(id, apiKey);
    }

    if (info.status === "failed" || info.status === "error" || info.status === "cancelled") {
      throw new Error(info.error?.message ?? info.error ?? "Clip generation failed.");
    }
    if (Date.now() > deadline) throw new Error("Clip generation timed out after 10 minutes.");
  }
}


export const generateSceneImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sceneId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; assetId: string } | { ok: false; error: string }> => {
    const sb = context.supabase as any;
    const { data: scene } = await sb.from("scenes").select("id,project_id,title,narration,visual_prompt").eq("id", data.sceneId).maybeSingle();
    if (!scene) return { ok: false, error: "Scene not found" };
    const { data: project } = await sb.from("projects").select("id,user_id,format,visual_style,idea,title").eq("id", scene.project_id).maybeSingle();
    if (!project) return { ok: false, error: "Project not found" };
    const subject = (scene.visual_prompt || scene.narration || scene.title || "").trim();
    if (!subject) return { ok: false, error: "Add a visual description to this scene first." };

    const { data: task } = await sb.from("ai_tasks").select("model").eq("slug", "scene_image").maybeSingle();
    const { data: jobId, error: je } = await sb.rpc("start_generation_job", {
      _task_slug: "scene_image", _project_id: project.id, _input: { scene_id: scene.id },
    });
    if (je || !jobId) return { ok: false, error: je?.message?.includes("INSUFFICIENT_CREDITS") ? "Not enough credits." : "Couldn't start the AI job." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) throw new Error("AI is not configured");
      const style = VISUAL_STYLES[(project.visual_style as VisualStyle)] ?? VISUAL_STYLES.cinematic;
      const aspect = project.format === "short" ? "vertical 9:16 portrait" : "horizontal 16:9 widescreen";
      const prompt = `${subject}\n\nStyle: ${style.prompt}. Composition: ${aspect} frame. Video context: ${project.idea || project.title}. No text, captions, watermarks or logos.`;
      const { generateImageBytes } = await import("./ai-image.server");
      const bytes = await generateImageBytes(apiKey, task?.model ?? "google/gemini-3.1-flash-image", prompt);
      const path = `${project.user_id}/${project.id}/scene-${scene.id}-${Date.now()}.png`;
      const up = await sb.storage.from("project-assets").upload(path, bytes, { contentType: "image/png" });
      if (up.error) throw new Error("Couldn't save the image");
      const { data: asset, error } = await sb.from("assets").insert({
        project_id: project.id, scene_id: scene.id, kind: "image", name: `${scene.title}.png`, storage_path: path,
        meta: { type: "image/png", size: bytes.length, generated: true, style: project.visual_style, prompt: subject },
      }).select("id").single();
      if (error) throw new Error("Couldn't save the image");
      await supabaseAdmin.rpc("complete_generation_job", { _job_id: jobId as string, _output: { asset_id: asset.id } });
      return { ok: true, assetId: asset.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Image generation failed";
      console.error("scene_image failed", e);
      await supabaseAdmin.rpc("fail_generation_job", { _job_id: jobId as string, _error: msg });
      return { ok: false, error: `${msg} Your credits were refunded.` };
    }
  });


export const generateSceneClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sceneId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; assetId: string } | { ok: false; error: string }> => {
    const sb = context.supabase as any;
    const { data: scene } = await sb.from("scenes").select("id,project_id,title,narration,visual_prompt,duration_seconds").eq("id", data.sceneId).maybeSingle();
    if (!scene) return { ok: false, error: "Scene not found" };
    const { data: project } = await sb.from("projects").select("id,user_id,format,visual_style,idea,title").eq("id", scene.project_id).maybeSingle();
    if (!project) return { ok: false, error: "Project not found" };
    const subject = (scene.visual_prompt || scene.narration || scene.title || "").trim();
    if (!subject) return { ok: false, error: "Add a visual description to this scene first." };

    const { data: task } = await sb.from("ai_tasks").select("model").eq("slug", "generate_clip").maybeSingle();
    const { data: jobId, error: je } = await sb.rpc("start_generation_job", {
      _task_slug: "generate_clip", _project_id: project.id, _input: { scene_id: scene.id },
    });
    if (je || !jobId) return { ok: false, error: je?.message?.includes("INSUFFICIENT_CREDITS") ? "Not enough credits." : "Couldn't start the AI job." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) throw new Error("AI is not configured");
      const style = VISUAL_STYLES[(project.visual_style as VisualStyle)] ?? VISUAL_STYLES.cinematic;
      const aspect = project.format === "short" ? "vertical 9:16 composition" : "widescreen 16:9 composition";
      const prompt = `${subject}\n\nStyle: ${style.prompt}. ${aspect}. Video context: ${project.idea || project.title}. Natural motion, cinematic camera movement, no text, watermarks or logos.`;
      const bytes = await generateSceneClipBytes(apiKey, task?.model ?? "google/veo-3.1-lite", prompt, Number(scene.duration_seconds) || 5, project.format === "short");
      const path = `${project.user_id}/${project.id}/scene-${scene.id}-${Date.now()}.mp4`;
      const up = await supabaseAdmin.storage.from("project-assets").upload(path, bytes, { contentType: "video/mp4" });
      if (up.error) throw new Error("Couldn't save the generated clip");
      const { data: asset, error } = await supabaseAdmin.from("assets").insert({
        project_id: project.id, scene_id: scene.id, kind: "video", name: `${scene.title}.mp4`, storage_path: path,
        meta: { type: "video/mp4", size: bytes.length, generated: true, task: "generate_clip", prompt: subject },
      }).select("id").single();
      if (error) throw new Error("Couldn't save the generated clip");
      await supabaseAdmin.from("scenes").update({ clip_path: path }).eq("id", scene.id);
      await supabaseAdmin.rpc("complete_generation_job", { _job_id: jobId as string, _output: { asset_id: asset.id, path } });
      return { ok: true, assetId: asset.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Clip generation failed";
      console.error("generate_clip failed", e);
      await supabaseAdmin.rpc("fail_generation_job", { _job_id: jobId as string, _error: msg });
      return { ok: false, error: `${msg} Your credits were refunded.` };
    }
  });
