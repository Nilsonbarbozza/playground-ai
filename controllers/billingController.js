import { TopupService } from '../services/billing/topup.service.js';
import { StripeService } from '../services/billing/stripe.service.js';

export const listCreditPackages = async (req, res) => {
  try {
    const packages = await TopupService.listPackages();
    res.json({ success: true, packages });
  } catch (err) {
    console.error('[BILLING_PACKAGES_ERR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const createCheckoutSession = async (req, res) => {
  try {
    const { package_id: packageId } = req.body || {};
    if (!packageId) {
      return res.status(400).json({ success: false, error: 'package_id e obrigatorio.' });
    }

    const result = await TopupService.createCheckoutSession({
      userId: req.user.id,
      packageId
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[BILLING_CHECKOUT_ERR]', err.message);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

export const getCreditOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await TopupService.getOrderStatus({
      userId: req.user.id,
      orderId: id
    });
    res.json({ success: true, order });
  } catch (err) {
    console.error('[BILLING_ORDER_STATUS_ERR]', err.message);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
};

export const stripeWebhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, error: 'Stripe-Signature ausente.' });
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ success: false, error: 'STRIPE_WEBHOOK_SECRET nao configurada.' });
    }

    const event = StripeService.constructWebhookEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    await TopupService.processStripeWebhook(event);
    res.json({ received: true });
  } catch (err) {
    console.error('[BILLING_WEBHOOK_ERR]', err.message);
    res.status(400).json({ success: false, error: `Webhook error: ${err.message}` });
  }
};
