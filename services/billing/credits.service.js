import db from '../../config/db.js';
import { UsersRepository } from '../../repositories/users.repository.js';
import { CreditTransactionsRepository } from '../../repositories/credit-transactions.repository.js';
import { CreditLedgerRepository } from '../../repositories/credit-ledger.repository.js';

export class CreditService {
  static _assertPositiveAmount(amount) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Valor de credito invalido.');
    }
  }

  static async reserveCredits({ userId, amount, description, operationKey }) {
    this._assertPositiveAmount(amount);
    if (!operationKey) throw new Error('operationKey e obrigatorio para reserva de credito.');

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const existingTx = await CreditTransactionsRepository.findByOperationKeyForUpdateWithClient(
        client,
        operationKey
      );

      if (existingTx) {
        if (existingTx.status === 'reserved' || existingTx.status === 'captured') {
          await client.query('COMMIT');
          return existingTx;
        }
        throw new Error(`Transacao de credito ja finalizada com status ${existingTx.status}.`);
      }

      const user = await UsersRepository.findCreditsForUpdateWithClient(client, userId);
      if (!user) throw new Error('Usuario nao encontrado.');
      if (user.credits < amount) throw new Error('Saldo insuficiente para esta operacao.');

      await UsersRepository.decrementCreditsWithClient(client, userId, amount);

      const tx = await CreditTransactionsRepository.createWithClient(client, {
        userId,
        operationKey,
        amount,
        status: 'reserved',
        description: description || null
      });

      await CreditLedgerRepository.addWithClient(client, {
        userId,
        amount: -amount,
        description: `RESERVE: ${description || 'sem descricao'} [${operationKey}]`
      });

      await client.query('COMMIT');
      return tx;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async captureReservation(operationKey) {
    if (!operationKey) throw new Error('operationKey e obrigatorio para captura.');

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const tx = await CreditTransactionsRepository.findByOperationKeyForUpdateWithClient(client, operationKey);
      if (!tx) throw new Error('Transacao de credito nao encontrada.');

      if (tx.status === 'captured') {
        await client.query('COMMIT');
        return tx;
      }
      if (tx.status !== 'reserved') {
        throw new Error(`Nao e possivel capturar transacao com status ${tx.status}.`);
      }

      const updated = await CreditTransactionsRepository.updateStatusWithClient(
        client,
        operationKey,
        'captured'
      );

      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async releaseReservation(operationKey, reason = 'Falha na operacao') {
    if (!operationKey) throw new Error('operationKey e obrigatorio para liberacao.');

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const tx = await CreditTransactionsRepository.findByOperationKeyForUpdateWithClient(client, operationKey);
      if (!tx) {
        await client.query('COMMIT');
        return null;
      }

      if (tx.status === 'released' || tx.status === 'refunded') {
        await client.query('COMMIT');
        return tx;
      }
      if (tx.status === 'captured') {
        throw new Error('Transacao capturada. Use refundCaptured para estorno.');
      }
      if (tx.status !== 'reserved') {
        throw new Error(`Status de transacao invalido para liberacao: ${tx.status}.`);
      }

      await UsersRepository.incrementCreditsWithClient(client, tx.user_id, tx.amount);

      const updated = await CreditTransactionsRepository.updateStatusWithClient(
        client,
        operationKey,
        'released'
      );

      await CreditLedgerRepository.addWithClient(client, {
        userId: tx.user_id,
        amount: tx.amount,
        description: `RELEASE: ${reason} [${operationKey}]`
      });

      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async refundCaptured(operationKey, reason = 'Estorno apos captura') {
    if (!operationKey) throw new Error('operationKey e obrigatorio para estorno.');

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const tx = await CreditTransactionsRepository.findByOperationKeyForUpdateWithClient(client, operationKey);
      if (!tx) {
        await client.query('COMMIT');
        return null;
      }

      if (tx.status === 'refunded' || tx.status === 'released') {
        await client.query('COMMIT');
        return tx;
      }

      if (tx.status === 'reserved') {
        await UsersRepository.incrementCreditsWithClient(client, tx.user_id, tx.amount);
        const released = await CreditTransactionsRepository.updateStatusWithClient(
          client,
          operationKey,
          'released'
        );
        await CreditLedgerRepository.addWithClient(client, {
          userId: tx.user_id,
          amount: tx.amount,
          description: `RELEASE: ${reason} [${operationKey}]`
        });
        await client.query('COMMIT');
        return released;
      }

      if (tx.status !== 'captured') {
        throw new Error(`Status de transacao invalido para estorno: ${tx.status}.`);
      }

      await UsersRepository.incrementCreditsWithClient(client, tx.user_id, tx.amount);
      const updated = await CreditTransactionsRepository.updateStatusWithClient(
        client,
        operationKey,
        'refunded'
      );
      await CreditLedgerRepository.addWithClient(client, {
        userId: tx.user_id,
        amount: tx.amount,
        description: `REFUND: ${reason} [${operationKey}]`
      });

      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async useCredits(userId, amount, description) {
    const operationKey = `legacy-use-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.reserveCredits({ userId, amount, description, operationKey });
    await this.captureReservation(operationKey);
    return true;
  }

  static async refundCredits(userId, amount, description) {
    this._assertPositiveAmount(amount);
    const operationKey = `legacy-refund-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await UsersRepository.incrementCreditsWithClient(client, userId, amount);
      await CreditLedgerRepository.addWithClient(client, {
        userId,
        amount,
        description: `REFUND: ${description}`
      });
      await CreditTransactionsRepository.createWithClient(client, {
        userId,
        operationKey,
        amount,
        status: 'refunded',
        description: `Legacy refund: ${description}`
      });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
