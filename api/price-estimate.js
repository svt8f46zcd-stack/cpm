import tariffsFile from '../data/tariffs.json' with { type: 'json' };
import { filterAndRankTariffs } from '../js/tariff-engine.js';

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const source = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  const postalCode = String(source.postalCode || '').replace(/\D/g, '');
  const electricity = Number(source.electricity || source.consumptionKwh);

  if (!/^\d{5}$/.test(postalCode) || !Number.isFinite(electricity) || electricity <= 0) {
    return res.status(400).json({ error: 'Gültige PLZ und Verbrauch erforderlich' });
  }

  try {
    const offers = filterAndRankTariffs(tariffsFile.tariffs, {
      postalCode,
      energyType: 'electricity',
      consumptionKwh: electricity,
    });

    if (!offers.length) {
      return res.status(404).json({
        success: false,
        postalCode,
        electricity,
        offers: [],
        message: 'Für diese PLZ sind derzeit keine verifizierten Stromtarife hinterlegt.',
      });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({
      success: true,
      postalCode,
      electricity,
      offers,
      bestOffer: offers[0],
      dataUpdatedAt: tariffsFile.updatedAt || null,
      disclaimer: 'Unverbindliche Tarifübersicht auf Basis manuell geprüfter Tarifdaten. Preise und Vertragsbedingungen vor Vertragsabschluss prüfen.',
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Tarifvergleich konnte nicht durchgeführt werden.' });
  }
}
