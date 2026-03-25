import { StabilityProvider } from './providers/stabilityProvider.js';
import { OpenAIProvider } from './providers/openaiProvider.js';
import { ReplicateProvider } from './providers/replicateProvider.js';

/**
 * Engine Factory - Professional SaaS Version
 * Handles lazy initialization of AI providers to ensure environment variables are loaded.
 */
class EngineFactory {
  constructor() {
    this.providers = new Map();
  }

  /**
   * Lazy getter for providers
   */
  get(name) {
    if (!this.providers.has(name)) {
      this._initializeProvider(name);
    }
    return this.providers.get(name);
  }

  _initializeProvider(name) {
    console.log(`[EngineFactory] Initializing provider: ${name}`);
    
    switch (name) {
      case 'stability':
        if (!process.env.STABILITY_API_KEY) throw new Error('STABILITY_API_KEY is missing.');
        this.providers.set(name, new StabilityProvider(process.env.STABILITY_API_KEY));
        break;
      
      case 'openai':
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');
        this.providers.set(name, new OpenAIProvider(process.env.OPENAI_API_KEY));
        break;
      
      case 'replicate':
        if (!process.env.REPLICATE_API_KEY) throw new Error('REPLICATE_API_KEY is missing.');
        this.providers.set(name, new ReplicateProvider(process.env.REPLICATE_API_KEY));
        break;

      default:
        throw new Error(`AI Provider '${name}' is not supported.`);
    }
  }

  /**
   * External registration for future engines (Workflow Support)
   */
  register(name, providerInstance) {
    this.providers.set(name, providerInstance);
    console.log(`[EngineFactory] Manually registered provider: ${name}`);
  }
}

export const engineFactory = new EngineFactory();
