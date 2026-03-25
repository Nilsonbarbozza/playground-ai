import axios from 'axios';
import FormData from 'form-data';
import { BaseProvider } from '../baseProvider.js';

export class StabilityProvider extends BaseProvider {
  /**
   * Text-to-Image Generation (Model: Core)
   * @param {Object} options { prompt: string }
   */
  async generate(options) {
    const { prompt } = options;
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('output_format', 'png');

    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/generate/core',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "image/*"
        },
        responseType: 'arraybuffer'
      }
    );

    if (response.status !== 200) {
      throw new Error(`Stability API Error: ${response.data.toString()}`);
    }

    return response.data; // Buffer
  }

  /**
   * Inpaint or Erase (Model: Edit)
   * @param {Object} options { image: Buffer, mask: Buffer, prompt: string, negative_prompt: string, intent: 'EDIT'|'ERASE' }
   */
  async edit(options) {
    const { image, mask, prompt, negative_prompt, intent } = options;
    
    const endpoint = intent === 'ERASE' 
      ? 'https://api.stability.ai/v2beta/stable-image/edit/erase'
      : 'https://api.stability.ai/v2beta/stable-image/edit/inpaint';

    const formData = new FormData();
    formData.append('image', image, { filename: 'image.png', contentType: 'image/png' });
    
    if (mask) {
      formData.append('mask', mask, { filename: 'mask.png', contentType: 'image/png' });
    }

    if (intent === 'EDIT') {
      formData.append('prompt', prompt);
      if (negative_prompt) formData.append('negative_prompt', negative_prompt);
    }
    
    formData.append('seed', 0);
    formData.append('output_format', 'png');

    const response = await axios.post(
      endpoint,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "image/*"
        },
        responseType: 'arraybuffer'
      }
    );

    if (response.status !== 200) {
      throw new Error(`Stability AI Edit (${intent}) Error: ${response.data.toString()}`);
    }

    return response.data; // Buffer
  }

  /**
   * Image-to-Video Animation
   */
  async submitVideoJob(imageBuffer) {
    const formData = new FormData();
    formData.append('image', imageBuffer, { filename: 'image.png', contentType: 'image/png' });
    formData.append('seed', 0);
    formData.append('cfg_scale', 1.8);
    formData.append('motion_bucket_id', 127);

    const response = await axios.post(
      'https://api.stability.ai/v2beta/image-to-video',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${this.apiKey}`
        }
      }
    );

    return response.data.id; // job id
  }

  async getVideoStatus(jobId) {
    const response = await axios.get(
      `https://api.stability.ai/v2beta/image-to-video/result/${jobId}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "video/*"
        },
        responseType: 'arraybuffer',
        validateStatus: undefined
      }
    );
    return response; // 200 with data or 202
  }
}
