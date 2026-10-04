export const VISUAL_STYLES = {
  cinematic: { label: "Cinematic", prompt: "cinematic film still, dramatic lighting, shallow depth of field, rich color grade" },
  documentary: { label: "Documentary", prompt: "realistic documentary photograph, natural light, authentic detail" },
  anime: { label: "Anime", prompt: "high quality anime illustration, clean line art, vibrant cel shading" },
  watercolor: { label: "Watercolor", prompt: "soft watercolor painting, textured paper, gentle washes of color" },
  "3d": { label: "3D render", prompt: "stylized 3D animated render, soft global illumination, Pixar-like" },
  noir: { label: "Noir", prompt: "black and white film noir, hard shadows, high contrast, moody" },
} as const;
export type VisualStyle = keyof typeof VISUAL_STYLES;
