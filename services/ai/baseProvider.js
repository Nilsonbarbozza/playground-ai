/**
 * Base AI Provider Class
 * Defines the standard interface for all AI engines.
 */
export class BaseProvider {
  constructor(apiKey) {
    if (this.constructor === BaseProvider) {
      throw new Error("BaseProvider is abstract and cannot be instantiated directly.");
    }
    this.apiKey = apiKey;
  }

  /**
   * Primary generation method (Text-to-Image / Image-to-Video)
   * @param {Object} options 
   */
  async generate(options) {
    throw new Error("Method 'generate()' must be implemented.");
  }

  /**
   * Edit method (Inpaint / Erase)
   * @param {Object} options 
   */
  async edit(options) {
    throw new Error("Method 'edit()' must be implemented.");
  }

  /**
   * Status polling method
   * @param {string} jobId 
   */
  async getStatus(jobId) {
    throw new Error("Method 'getStatus()' must be implemented.");
  }
}
