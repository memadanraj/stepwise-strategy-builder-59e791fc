import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { VISUAL_STYLES, type VisualStyle } from "./visual-styles";

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
