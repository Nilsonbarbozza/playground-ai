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
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an elite Art Director and Computer Vision Architect.
Analyze the user's instruction and image to output a hyper-precise JSON.

INTENT ROUTING:
- ERASE: if deleting/removing objects.
- EDIT: if changing colors, adding objects, or replacing things.

JSON FORMAT:
{
  "intent": "ERASE" | "EDIT",
  "target_hex": "<HEX or null>",
  "target_color_name": "<color name>",
  "prompt": "<fragmented description of the OBJECT ONLY in EN>",
  "negative_prompt": "<exhaustive block of artifacts/logos to avoid>"
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
          image_detail: 'low'
        }
      });
      throw err;
    }
  }
}
