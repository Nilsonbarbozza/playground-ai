import Stripe from 'stripe';

let stripeClient = null;

function getStripeClient() {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY nao configurada.');
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export class StripeService {
  static createCheckoutSession(params, requestOptions) {
    return getStripeClient().checkout.sessions.create(params, requestOptions);
  }

  static constructWebhookEvent(rawBody, signature, webhookSecret) {
    return getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}
