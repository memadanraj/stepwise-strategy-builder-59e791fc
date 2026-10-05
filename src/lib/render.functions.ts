import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRenderProvider, type RenderManifest } from "./render.providers.server";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function signManifest(sbAdmin: any, manifest: RenderManifest) {
  const paths = new Set<string>();

  for (const asset of manifest.assets) if (asset.storage_path) paths.add(asset.storage_path);
  for (const scene of manifest.scenes) {
    if (scene.image_path) paths.add(scene.image_path);
    if (scene.clip_path) paths.add(scene.clip_path);
  }

  const list = [...paths];
  const urls = new Map<string, string>();

  if (list.length) {
    const result = await sbAdmin.storage.from("project-assets").createSignedUrls(list, 86400);
    if (result.error) throw new Error("Couldn't prepare project files for rendering");
    for (const item of result.data ?? []) {
      if (item?.signedUrl && item?.path) urls.set(item.path, item.signedUrl);
    }
  }

  for (const asset of manifest.assets) asset.url = urls.get(asset.storage_path);
  for (const scene of manifest.scenes) {
    scene.image_url = scene.image_path ? urls.get(scene.image_path) : undefined;
    scene.clip_url = scene.clip_path ? urls.get(scene.clip_path) : undefined;
  }
}

async function buildManifest(sb: any, projectId: string) {
  const [projectResult, tracksResult, clipsResult, captionsResult, assetsResult, settingsResult, scenesResult] =
    await Promise.all([
      sb.from("projects").select("id,title,format,user_id").eq("id", projectId).maybeSingle(),
      sb.from("timeline_tracks").select("*").eq("project_id", projectId).order("position"),
      sb.from("timeline_clips").select("*").eq("project_id", projectId).order("start_seconds"),
      sb.from("captions").select("*").eq("project_id", projectId).order("start_seconds"),
      sb.from("assets").select("id,kind,name,storage_path,meta,scene_id").eq("project_id", projectId),
      sb.from("timeline_settings").select("*").eq("project_id", projectId).maybeSingle(),
      sb.from("scenes").select("id,title,duration_seconds,position,image_path,clip_path,narration,visual_prompt").eq("project_id", projectId).order("position"),
    ]);

  if (projectResult.error || !projectResult.data) throw new Error("Project not found");
  for (const result of [tracksResult, clipsResult, captionsResult, assetsResult, scenesResult]) {
    if (result.error) throw result.error;
  }

  const project = projectResult.data;
  const settings = settingsResult.data ?? {
    fps: 30,
    width: project.format === "short" ? 1080 : 1920,
    height: project.format === "short" ? 1920 : 1080,
  };

  return {
    project,
    manifest: {
      projectId,
      width: settings.width,
      height: settings.height,
      fps: settings.fps,
      format: project.format,
      scenes: scenesResult.data ?? [],
      tracks: tracksResult.data ?? [],
      clips: clipsResult.data ?? [],
      captions: captionsResult.data ?? [],
      assets: assetsResult.data ?? [],
    } as RenderManifest,
  };
}

export const createRenderJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    projectId: z.string().uuid(),
    presetId: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const sb = context.supabase as any;
      const sbAdmin = await admin();
      const { manifest } = await buildManifest(sb, data.projectId);
      await signManifest(sbAdmin, manifest);

      const preset = data.presetId
        ? (await sb.from("render_presets").select("*").eq("id", data.presetId).eq("project_id", data.projectId).maybeSingle()).data
        : null;

      if (preset) {
        manifest.width = preset.width;
        manifest.height = preset.height;
        manifest.fps = preset.fps;
      }

      const inserted = await sb.from("render_jobs").insert({
        project_id: data.projectId,
        user_id: context.userId,
        preset_id: preset?.id ?? null,
        status: "queued",
        provider: "cloud",
        progress: 0,
        input_manifest: manifest,
      }).select("id").single();

      if (inserted.error || !inserted.data) throw inserted.error ?? new Error("Couldn't create render job");

      const jobId = inserted.data.id;
      const provider = getRenderProvider();

      if (!provider) {
        return {
          ok: true as const,
          jobId,
          dispatched: false,
          message: "Render queued. Configure SHOTSTACK_API_KEY or RENDERER_URL to dispatch cloud rendering.",
        };
      }

      try {
        const submitted = await provider.submit(manifest);
        await sbAdmin.from("render_jobs").update({
          status: "processing",
          provider_job_id: submitted.providerJobId,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);

        return { ok: true as const, jobId, dispatched: true, message: "Render dispatched." };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Render dispatch failed";
        await sbAdmin.from("render_jobs").update({
          status: "failed",
          error: message,
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);
        return { ok: false as const, error: message };
      }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Couldn't create render job." };
    }
  });

export const getRenderJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    projectId: z.string().uuid(),
    jobId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const sbAdmin = await admin();
    const found = await sb.from("render_jobs").select("*")
      .eq("id", data.jobId).eq("project_id", data.projectId).maybeSingle();

    if (found.error || !found.data) return { ok: false as const, error: "Render job not found." };

    const job: any = found.data;

    if (job.provider_job_id && (job.status === "processing" || job.status === "queued")) {
      const provider = getRenderProvider();
      if (provider) {
        try {
          const status = await provider.status(job.provider_job_id);
          const terminal = status.status === "completed" || status.status === "failed";

          await sbAdmin.from("render_jobs").update({
            status: status.status,
            progress: status.progress,
            error: status.error ?? null,
            finished_at: terminal ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          }).eq("id", job.id);

          job.status = status.status;
          job.progress = status.progress;
          job.error = status.error ?? null;

          if (status.status === "completed" && status.outputUrl) {
            const existing = await sbAdmin.from("exports").select("id").eq("render_job_id", job.id).maybeSingle();

            if (!existing.data) {
              const download = await fetch(status.outputUrl);
              if (!download.ok) throw new Error(`Couldn't download renderer output (${download.status}).`);

              const bytes = new Uint8Array(await download.arrayBuffer());
              const path = `${job.user_id}/${data.projectId}/exports/${job.id}.mp4`;

              const upload = await sbAdmin.storage.from("project-assets").upload(path, bytes, {
                contentType: "video/mp4",
                upsert: true,
              });
              if (upload.error) throw new Error("Couldn't store rendered export");

              const asset = await sbAdmin.from("assets").insert({
                project_id: data.projectId,
                kind: "video",
                name: `Export ${job.id}.mp4`,
                storage_path: path,
                meta: { render_job_id: job.id },
              }).select("id").single();
              if (asset.error) throw new Error("Couldn't register rendered export asset");

              const exportRow = await sbAdmin.from("exports").insert({
                project_id: data.projectId,
                render_job_id: job.id,
                asset_id: asset.data?.id ?? null,
                format: "mp4",
                storage_path: path,
                filename: `export-${job.id}.mp4`,
                size_bytes: bytes.byteLength,
                width: job.input_manifest?.width,
                height: job.input_manifest?.height,
                fps: job.input_manifest?.fps,
                status: "ready",
              });
              if (exportRow.error) throw new Error("Couldn't register rendered export");
            }
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : "Render status check failed";
          await sbAdmin.from("render_jobs").update({
            status: "failed",
            error: message,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", job.id);
          job.status = "failed";
          job.error = message;
        }
      }
    }

    return { ok: true as const, job };
  });

export const cancelRenderJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    projectId: z.string().uuid(),
    jobId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const result = await sb.from("render_jobs").update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    }).eq("id", data.jobId).eq("project_id", data.projectId).in("status", ["queued", "processing"]);
    if (result.error) return { ok: false as const, error: result.error.message };
    return { ok: true as const };
  });

export const getExportUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    projectId: z.string().uuid(),
    exportId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const result = await sb.from("exports").select("storage_path,filename,status")
      .eq("id", data.exportId).eq("project_id", data.projectId).maybeSingle();

    if (result.error || !result.data) return { ok: false as const, error: "Export not found." };
    if (!result.data.storage_path || result.data.status !== "ready") return { ok: false as const, error: "Export is not ready." };

    const signed = await sb.storage.from("project-assets").createSignedUrl(result.data.storage_path, 900);
    if (signed.error) return { ok: false as const, error: signed.error.message };

    return { ok: true as const, url: signed.data.signedUrl, filename: result.data.filename };
  });
