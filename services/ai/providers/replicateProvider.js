import axios from 'axios';
import { BaseProvider } from '../baseProvider.js';

export class ReplicateProvider extends BaseProvider {
  /**
   * Run FaceSwap Prediction (lucataco/faceswap)
   */
  async generate(options) {
    const { target_image_base64, swap_image_base64 } = options;
    const modelVersion = "9a4298548422074c3f57258c5d544497314ae4112df80d116f0d2109e843d20d";

    const response = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: modelVersion,
        input: {
          target_image: target_image_base64,
          swap_image: swap_image_base64
        }
      },
      {
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data; // { id, status, urls: { get } }
  }

  /**
   * Poll Status
   */
  async getStatus(predictionUrl) {
    const response = await axios.get(predictionUrl, {
      headers: { Authorization: `Token ${this.apiKey}` }
    });
    return response.data;
  }
}
