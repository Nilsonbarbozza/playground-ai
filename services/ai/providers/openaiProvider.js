import OpenAI from 'openai';
import { BaseProvider } from '../baseProvider.js';
import { TelemetryInternalService } from '../../telemetry/telemetry-internal.service.js';

export class OpenAIProvider extends BaseProvider {
  constructor(apiKey) {
    super(apiKey);
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  /**
   * Analyze Image Content and User Intent (GPT-4o-mini Vision)
   */
  async analyzeIntent(userPrompt, imageBase64) {
    const startedAt = Date.now();
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an elite Art Director and Computer Vision Architect.
Analyze the user's instruction and image to output a hyper-precise JSON.

CRITICAL RULES FOR "EDIT" INTENT:
1. NEVER mutate the object's original shape, geometry, model, or structure.
2. If changing color, the "prompt" MUST heavily emphasize the exact new color applied to the SAME object surface.
3. Your "prompt" must describe ONLY the final object's appearance, pure and photographic.
4. Your "negative_prompt" MUST include words preventing deformation or mutation.

INTENT ROUTING:
- ERASE: if deleting/removing objects entirely.
- EDIT: if changing colors, adding objects, or replacing textures.

JSON FORMAT:
{
  "intent": "ERASE" | "EDIT",
  "target_hex": "<HEX or null>",
  "target_color_name": "<color name in English>",
  "prompt": "<highly specific, fragmented visual description of the resulting OBJECT ONLY in EN, preserving shape>",
  "negative_prompt": "<exhaustive block of artifacts/logos/mutations/deformations/3d-render to avoid>"
}
`
        },
          {
            role: "user",
            content: [
              { type: "text", text: `User Instruction: ${userPrompt}` },
              { type: "image_url", image_url: { url: imageBase64, detail: "low" } }
            ]
          }
        ]
      });

      await TelemetryInternalService.trackProviderCall({
        provider: 'openai',
        model: 'gpt-4o-mini',
        operation: 'analyze_intent',
        status: 'success',
        latencyMs: Date.now() - startedAt,
        module: 'image-editor',
        params: {
          prompt_len: String(userPrompt || '').length,
          image_detail: 'low'
        }
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (err) {
      await TelemetryInternalService.trackProviderCall({
        provider: 'openai',
        model: 'gpt-4o-mini',
        operation: 'analyze_intent',
        status: 'error',
        latencyMs: Date.now() - startedAt,
        module: 'image-editor',
        errorCode: err?.code || null,
        errorMessage: err?.message || 'OpenAI analyzeIntent error',
        params: {
          prompt_len: String(userPrompt || '').length,
        }
      });
      throw err;
    }
  }

  /**
   * Translate and enhance a Text-to-Image prompt, reinforcing colors.
   */
  async enhanceTextToImagePrompt(userPrompt, stylePreset = null) {
    const startedAt = Date.now();
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an elite Prompt Engineer for Stable Diffusion.
Your job is to translate (to English) and heavily optimize the user's prompt.

CRITICAL RULES:
1. Translate to English.
2. If the user mentions specific colors (e.g. "red car"), you MUST forcefully repeat the color in the prompt (e.g., "strictly red colored, pure red, 100% red") to prevent color bleeding.
3. Add a professional negative prompt to prevent blurriness, watermarks, deformities, and bad anatomy.
4. Keep the subject focus exactly as the user requested. If they mention a style preset like "${stylePreset || 'none'}", harmonize the prompt with it.

JSON FORMAT:
{
  "final_prompt": "<highly detailed, redundant color-enforced English prompt>",
  "negative_prompt": "<exhaustive list of artifacts to avoid>"
}
`
          },
          {
            role: "user",
            content: `User Instruction: ${userPrompt}`
          }
        ]
      });

      await TelemetryInternalService.trackProviderCall({
        provider: 'openai',
        model: 'gpt-4o-mini',
        operation: 'enhance_t2i',
        status: 'success',
        latencyMs: Date.now() - startedAt,
        module: 'text-to-image'
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (err) {
      await TelemetryInternalService.trackProviderCall({
        provider: 'openai',
        model: 'gpt-4o-mini',
        operation: 'enhance_t2i',
        status: 'error',
        latencyMs: Date.now() - startedAt,
        module: 'text-to-image',
        errorCode: err?.code || null,
        errorMessage: err?.message || 'OpenAI enhanceTextToImagePrompt error'
      });
      throw err;
    }
  }
}
