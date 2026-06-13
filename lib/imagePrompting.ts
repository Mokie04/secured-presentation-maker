import type { ImageStyle } from '../types';

export function buildFinalImagePrompt(
  prompt: string,
  style: ImageStyle = 'illustration',
  _language: 'EN' | 'FIL' = 'EN',
): string {
  let styleInstructions = '';

  switch (style) {
    case 'photorealistic':
      styleInstructions = 'Create a professional, high-resolution, photorealistic image. It must look like a real photograph with accurate lighting, optics, scale, and textures. Avoid vector art, SVG style, cartoons, 3D renders, flat icon cards, artistic embellishments, or fantastical elements. The final image must be a factually accurate representation of the subject. Under no circumstances should any text, letters, numbers, or words appear in the image.';
      break;
    case 'infographic':
      styleInstructions = 'Create a clean and modern infographic visual using a professional, cohesive color palette and clear icons. Do NOT render any words, labels, letters, numbers, symbols, or captions inside the image. Focus on visual structure only.';
      break;
    case 'diagram':
      styleInstructions = 'Create a high-resolution raster educational diagram, not SVG/vector-code output. Use thin, precise lines and a clean minimalist style. The diagram must be factually accurate, with no decorative clip art or confusing cartoon objects. For particle diagrams, particles must be equal-size, spacing must match the state of matter, and motion arrows must match the concept. The diagram may use simple arrows, dots, and shapes when scientifically required, but must NOT contain any words, labels, letters, numbers, or titles.';
      break;
    case 'historical photo':
      styleInstructions = 'Create an image that looks like an authentic historical photograph from the relevant era (e.g., black and white, sepia-toned). It should have realistic grain, lighting, and focus imperfections of the period. The depiction must be historically accurate. Avoid a modern, "costumed" look. Under no circumstances should any text, letters, numbers, or words appear in the image.';
      break;
    case 'illustration':
    default:
      styleInstructions = 'Create a professional, vibrant, and clear educational illustration with accurate subject matter and clean composition. Avoid SVG-like flat icon cards, cartoon simplifications, decorative filler, or anything that could misrepresent the concept. Under no circumstances should any text, letters, numbers, or words appear in the image.';
      break;
  }

  const relevanceGuard = 'Keep the content tightly on-topic to the described subject and make it a slide-specific evidence visual, not a reusable generic background. If the subject is a classroom activity, show the actual subject-specific materials, tool, output, specimen, process, or setting from the slide; do not substitute a generic teacher, student group, whiteboard, or classroom scene. Do NOT add any extra objects or unrelated scenes. No text, labels, numbers, watermarks, signatures, or UI chrome.';
  return `${styleInstructions} ${relevanceGuard} The image should depict: "${prompt}"`;
}
