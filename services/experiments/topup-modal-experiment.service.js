import { AbExperimentConfigsRepository } from '../../repositories/ab-experiment-configs.repository.js';

const EXPERIMENT_KEY = 'topup_modal_v1';

const DEFAULT_CONFIG = {
  experiment_key: EXPERIMENT_KEY,
  allocation: { A: 50, B: 50 },
  variants: {
    A: {
      modal_title: 'Adicionar Créditos',
      primary_cta: 'Pagar',
      starter_badge: 'Uso Profissional',
      starter_subtitle: 'Ferramentas avançadas para produtividade.'
    },
    B: {
      modal_title: 'Desbloquear Créditos',
      primary_cta: 'Garantir Créditos Agora',
      starter_badge: 'Oferta Recomendável',
      starter_subtitle: 'Acesse recursos premium com mais velocidade.'
    }
  }
};

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function cleanText(value, maxLen, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const out = value.trim().slice(0, maxLen);
  return out || fallback;
}

function normalizeConfig(input = {}) {
  const allocationA = clampInt(input?.allocation?.A, 0, 100, 50);
  const allocationB = 100 - allocationA;

  return {
    experiment_key: EXPERIMENT_KEY,
    allocation: {
      A: allocationA,
      B: allocationB
    },
    variants: {
      A: {
        modal_title: cleanText(input?.variants?.A?.modal_title, 120, DEFAULT_CONFIG.variants.A.modal_title),
        primary_cta: cleanText(input?.variants?.A?.primary_cta, 80, DEFAULT_CONFIG.variants.A.primary_cta),
        starter_badge: cleanText(input?.variants?.A?.starter_badge, 80, DEFAULT_CONFIG.variants.A.starter_badge),
        starter_subtitle: cleanText(
          input?.variants?.A?.starter_subtitle,
          180,
          DEFAULT_CONFIG.variants.A.starter_subtitle
        )
      },
      B: {
        modal_title: cleanText(input?.variants?.B?.modal_title, 120, DEFAULT_CONFIG.variants.B.modal_title),
        primary_cta: cleanText(input?.variants?.B?.primary_cta, 80, DEFAULT_CONFIG.variants.B.primary_cta),
        starter_badge: cleanText(input?.variants?.B?.starter_badge, 80, DEFAULT_CONFIG.variants.B.starter_badge),
        starter_subtitle: cleanText(
          input?.variants?.B?.starter_subtitle,
          180,
          DEFAULT_CONFIG.variants.B.starter_subtitle
        )
      }
    }
  };
}

export class TopupModalExperimentService {
  static async getActiveConfig() {
    const row = await AbExperimentConfigsRepository.findByKey(EXPERIMENT_KEY);
    if (!row?.config) {
      return DEFAULT_CONFIG;
    }
    return normalizeConfig(row.config);
  }

  static async updateConfig({ payload, adminUserId }) {
    const normalized = normalizeConfig(payload || {});
    const row = await AbExperimentConfigsRepository.upsertByKey({
      key: EXPERIMENT_KEY,
      config: normalized,
      updatedBy: adminUserId
    });
    return {
      experiment_key: row.key,
      config: normalizeConfig(row.config),
      updated_at: row.updated_at
    };
  }
}
