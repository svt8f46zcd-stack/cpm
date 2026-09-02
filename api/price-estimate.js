import tariffsFile from '../data/tariffs.json' with { type: 'json' };

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const postalCode = String(req.query.postalCode || '').replace(/\D/g, '');
  const electricity = Number(req.query.electricity);
  if (!/^\d{5}$/.test(postalCode) || !Number.isFinite(electricity) || electricity <= 0) {
    return res.status(400).json({ error: 'Gültige PLZ und Verbrauch erforderlich' });
  }
  const matches = tariffsFile.tariffs.filter(t => t.postalArea === postalCode && t.publicStatus !== 'hidden');
  if (!matches.length) return res.status(404).json({ error: 'Für diese PLZ sind noch keine freigegebenen Tarifdaten hinterlegt' });
  const offers = matches.map(t => ({
    ...t,
    estimatedAnnualCost: Math.round((t.electricityWorkPrice / 100) * electricity + t.electricityBasePriceAnnual),
    estimatedMonthlyCost: Math.round(((t.electricityWorkPrice / 100) * electricity + t.electricityBasePriceAnnual) / 12)
  })).sort((a, b) => a.estimatedAnnualCost - b.estimatedAnnualCost);
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ success: true, postalCode, electricity, offers, disclaimer: 'Unverbindliche Tarifübersicht auf Basis manuell geprüfter Tarifdaten. Preise und Bedingungen vor Vertragsabschluss bestätigen.' });
}
