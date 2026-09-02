import tariffsFile from '../data/tariffs.json' with { type: 'json' };
import { filterAndRankTariffs, buildComparisonSummary } from '../js/tariff-engine.js';

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const source = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  const postalCode = String(source.postalCode || '').replace(/\D/g, '');
  const energyType = String(source.energyType || source.energy || 'electricity').toLowerCase();
  const consumptionKwh = Number(source.consumptionKwh || source.electricity || source.gas);

  if (!/^\d{5}$/.test(postalCode)) {
    return res.status(400).json({ error: 'Gültige fünfstellige PLZ erforderlich.' });
  }
  if (!Number.isFinite(consumptionKwh) || consumptionKwh <= 0) {
    return res.status(400).json({ error: 'Gültiger Jahresverbrauch erforderlich.' });
  }

  try {
    const offers = filterAndRankTariffs(tariffsFile.tariffs, {
      postalCode,
      energyType,
      consumptionKwh,
    });

    if (!offers.length) {
      return res.status(404).json({
        success: false,
        postalCode,
        energyType,
        consumptionKwh,
        offers: [],
        message: 'Für diese PLZ und Energieart sind derzeit keine freigegebenen passenden Tarife hinterlegt.',
      });
    }

    const current = source.currentWorkPriceCtKwh && source.currentBasePriceAnnual
      ? {
          energyType,
          workPriceCtKwh: Number(source.currentWorkPriceCtKwh),
          basePriceAnnual: Number(source.currentBasePriceAnnual),
          newCustomerBonus: 0,
          instantBonus: 0,
        }
      : null;

    const summary = buildComparisonSummary(current, offers[0], consumptionKwh);

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({
      success: true,
      postalCode,
      energyType,
      consumptionKwh,
      offers,
      bestOffer: offers[0],
      summary,
      dataUpdatedAt: tariffsFile.updatedAt || null,
      disclaimer: 'Unverbindliche Tarifübersicht auf Basis der hinterlegten Tarifdaten. Preise und Vertragsbedingungen vor Vertragsschluss prüfen.',
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Vergleich konnte nicht durchgeführt werden.' });
  }
}
