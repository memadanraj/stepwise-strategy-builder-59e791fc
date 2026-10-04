ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS visual_style text NOT NULL DEFAULT 'cinematic';
INSERT INTO public.ai_tasks (slug, name, description, model, credit_cost) VALUES ('scene_image', 'Scene image', 'Generate a still image for one scene', 'google/gemini-3.1-flash-image', 4)
ON CONFLICT (slug) DO NOTHING;