import { randomUUID } from 'crypto';
import db from '../../config/db.js';
import { CreditPackagesRepository } from '../../repositories/credit-packages.repository.js';
import { CreditOrdersRepository } from '../../repositories/credit-orders.repository.js';
import { UsersRepository } from '../../repositories/users.repository.js';
import { CreditLedgerRepository } from '../../repositories/credit-ledger.repository.js';
import { WebhookEventsRepository } from '../../repositories/webhook-events.repository.js';
import { StripeService } from './stripe.service.js';
import { MailService } from '../mail/mail.service.js';

function getBaseUrl() {
  return process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
}

export class TopupService {
  static async listPackages() {
    return CreditPackagesRepository.listActive();
  }

  static async createCheckoutSession({ userId, packageId }) {
    const user = await UsersRepository.findProfileById(userId);
    if (!user) {
      const err = new Error('Usuario nao encontrado.');
      err.status = 404;
      throw err;
    }

    const pkg = await CreditPackagesRepository.findActiveById(packageId);
    if (!pkg) {
      const err = new Error('Pacote de creditos invalido ou inativo.');
      err.status = 400;
      throw err;
    }

    const order = await CreditOrdersRepository.createPending({
      userId,
      packageId: pkg.id,
      credits: pkg.credits,
      amountBrlCents: pkg.price_brl_cents,
      currency: 'brl',
      idempotencyKey: `topup-order:${randomUUID()}`
    });

    const baseUrl = getBaseUrl();
    const successUrl = `${baseUrl}/?checkout=success&order_id=${order.id}`;
    const cancelUrl = `${baseUrl}/?checkout=cancel&order_id=${order.id}`;

    const session = await StripeService.createCheckoutSession(
      {
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_method_types: ['card'],
        line_items: [
          {
            quantity: 1,
            ...(pkg.stripe_price_id
              ? { price: pkg.stripe_price_id }
              : {
                  price_data: {
                    currency: 'brl',
                    unit_amount: pkg.price_brl_cents,
                    product_data: {
                      name: pkg.name,
                      description: `${pkg.credits} creditos para AI Playground`
                    }
                  }
                })
          }
        ],
        metadata: {
          order_id: order.id,
          user_id: userId,
          package_id: pkg.id,
          credits: String(pkg.credits)
        }
      },
      { idempotencyKey: order.id }
    );

    await CreditOrdersRepository.attachCheckoutSession(order.id, session.id);

    return {
      order_id: order.id,
      checkout_url: session.url
    };
  }

  static async getOrderStatus({ userId, orderId }) {
    const order = await CreditOrdersRepository.findByIdAndUser(orderId, userId);
    if (!order) {
      const err = new Error('Pedido de creditos nao encontrado.');
      err.status = 404;
      throw err;
    }

    return {
      id: order.id,
      status: order.status,
      credits: order.credits,
      amount_brl_cents: order.amount_brl_cents,
      currency: order.currency,
      paid_at: order.paid_at,
      created_at: order.created_at
    };
  }

  static async processStripeWebhook(event) {
    try {
      if (await WebhookEventsRepository.hasEvent(event.id)) {
        return { duplicate: true };
      }

      switch (event.type) {
        case 'checkout.session.completed':
          return this._handleCheckoutCompleted(event);
        case 'checkout.session.expired':
          return this._handleCheckoutExpired(event);
        default:
          return { ignored: true };
      }
    } catch (err) {
      if (err.code === '23505') {
        return { duplicate: true };
      }
      throw err;
    }
  }

  static async _handleCheckoutCompleted(event) {
    const session = event.data.object;
    const orderId = session?.metadata?.order_id;
    if (!orderId) return { ignored: true };

    const paymentStatus = session.payment_status;
    if (paymentStatus !== 'paid') {
      return { ignored: true };
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      await WebhookEventsRepository.insertWithClient(client, {
        eventId: event.id,
        eventType: event.type,
        payload: event
      });

      const order = await CreditOrdersRepository.findByIdForUpdateWithClient(client, orderId);
      if (!order) {
        await client.query('COMMIT');
        return { ignored: true };
      }

      if (order.status === 'paid') {
        await client.query('COMMIT');
        return { duplicate: true };
      }

      await UsersRepository.incrementCreditsWithClient(client, order.user_id, order.credits);

      await CreditLedgerRepository.addWithClient(client, {
        userId: order.user_id,
        amount: order.credits,
        description: `TOPUP_ORDER:${order.id}`
      });

      await CreditOrdersRepository.updateStatusWithClient(client, order.id, {
        status: 'paid',
        checkoutSessionId: session.id,
        paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        paidAt: true
      });

      await client.query('COMMIT');
      
      // Dispara o e-mail de confirmacao
      try {
        const userProfile = await UsersRepository.findProfileById(order.user_id);
        if (userProfile) {
          await MailService.sendCreditConfirmationEmail(userProfile.email, order.credits, order.amount_brl_cents);
        }
      } catch (mailErr) {
        console.error('[Mail Credit Error]', mailErr);
      }

      return { processed: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async _handleCheckoutExpired(event) {
    const session = event.data.object;
    const orderId = session?.metadata?.order_id;
    if (!orderId) return { ignored: true };

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      await WebhookEventsRepository.insertWithClient(client, {
        eventId: event.id,
        eventType: event.type,
        payload: event
      });

      const order = await CreditOrdersRepository.findByIdForUpdateWithClient(client, orderId);
      if (!order) {
        await client.query('COMMIT');
        return { ignored: true };
      }

      if (order.status === 'paid') {
        await client.query('COMMIT');
        return { ignored: true };
      }

      await CreditOrdersRepository.updateStatusWithClient(client, order.id, {
        status: 'expired',
        checkoutSessionId: session.id
      });

      await client.query('COMMIT');
      return { processed: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
