import axios from 'axios';
import { BaseProvider } from '../baseProvider.js';
import { TelemetryInternalService } from '../../telemetry/telemetry-internal.service.js';

export class ReplicateProvider extends BaseProvider {
  /**
   * Run FaceSwap Prediction (lucataco/faceswap)
   */
  async generate(options) {
    const { target_image_base64, swap_image_base64 } = options;
    const modelVersion = "9a4298548422074c3f57258c5d544497314ae4112df80d116f0d2109e843d20d";
    const startedAt = Date.now();

    try {
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

      await TelemetryInternalService.trackProviderCall({
        provider: 'replicate',
        model: modelVersion,
        operation: 'faceswap_submit',
        status: 'success',
        latencyMs: Date.now() - startedAt,
        module: 'faceswap'
      });

      return response.data; // { id, status, urls: { get } }
    } catch (err) {
      await TelemetryInternalService.trackProviderCall({
        provider: 'replicate',
        model: modelVersion,
        operation: 'faceswap_submit',
        status: 'error',
        latencyMs: Date.now() - startedAt,
        module: 'faceswap',
        errorCode: err?.code || null,
        errorMessage: err?.message || 'Replicate submit error'
      });
      throw err;
    }
  }

  /**
   * Poll Status
   */
  async getStatus(predictionUrl) {
    const startedAt = Date.now();
    try {
      const response = await axios.get(predictionUrl, {
        headers: { Authorization: `Token ${this.apiKey}` }
      });
      await TelemetryInternalService.trackProviderCall({
        provider: 'replicate',
        model: 'faceswap',
        operation: 'faceswap_status',
        status: 'success',
        latencyMs: Date.now() - startedAt,
        module: 'faceswap'
      });
      return response.data;
    } catch (err) {
      await TelemetryInternalService.trackProviderCall({
        provider: 'replicate',
        model: 'faceswap',
        operation: 'faceswap_status',
        status: 'error',
        latencyMs: Date.now() - startedAt,
        module: 'faceswap',
        errorCode: err?.code || null,
        errorMessage: err?.message || 'Replicate status error'
      });
      throw err;
    }
  }
}
