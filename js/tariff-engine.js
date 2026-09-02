export const VERIFICATION_RANK = {
  verified: 3,
  verified_screenshot: 3,
  verified_screenshot_spotmarkt: 2,
  copied_user_confirmed: 2,
  user_confirmed: 2,
  copied_unverified: 1,
  unverified: 0,
  hidden: -1,
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeEnergyType(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['gas', 'erdgas', 'natural_gas'].includes(v)) return 'gas';
  return 'electricity';
}

function isVisibleAndVerified(tariff) {
  const status = String(tariff.verificationStatus || tariff.publicStatus || '').toLowerCase();
  return status !== 'hidden' && VERIFICATION_RANK[status] > 0;
}

function inConsumptionRange(tariff, consumption) {
  const min = num(tariff.minConsumptionKwh);
  const max = num(tariff.maxConsumptionKwh);
  if (min !== null && consumption < min) return false;
  if (max !== null && consumption > max) return false;
  return true;
}

export function calculateAnnualCosts(tariff, consumption, options = {}) {
  const kwh = num(consumption);
  if (kwh === null || kwh <= 0) throw new Error('Verbrauch muss größer als 0 sein.');

  const energyType = normalizeEnergyType(tariff.energyType || tariff.energy_type);
  const workPrice = num(tariff.workPriceCtKwh ?? tariff.electricityWorkPrice ?? tariff.gasWorkPrice);
  const basePrice = num(tariff.basePriceAnnual ?? tariff.electricityBasePriceAnnual ?? tariff.gasBasePriceAnnual) ?? 0;
  if (workPrice === null) throw new Error('Arbeitspreis des Tarifs fehlt.');

  let energyCost = workPrice / 100 * kwh;
  if (energyType === 'gas' && tariff.consumptionUnit === 'm3') {
    const conversion = num(tariff.m3ToKwhFactor) ?? 10;
    energyCost = workPrice / 100 * kwh * conversion;
  }

  const recurring = basePrice + energyCost;
  const newCustomerBonus = num(tariff.newCustomerBonus) ?? 0;
  const instantBonus = num(tariff.instantBonus) ?? 0;
  const oneTimeBonus = newCustomerBonus + instantBonus;

  const firstYearCost = Math.max(0, recurring - oneTimeBonus);
  const ongoingYearCost = recurring;

  return {
    energyType,
    consumptionKwh: kwh,
    workPriceCtKwh: workPrice,
    basePriceAnnual: basePrice,
    recurringAnnualCost: round2(recurring),
    oneTimeBonus: round2(oneTimeBonus),
    firstYearCost: round2(firstYearCost),
    ongoingYearCost: round2(ongoingYearCost),
    bonusApplied: oneTimeBonus > 0,
    calculationBasis: options.includeBonus === false ? 'ongoing' : 'first_year',
  };
}

export function filterAndRankTariffs(tariffs, input) {
  const postalCode = String(input.postalCode || '').replace(/\D/g, '');
  const energyType = normalizeEnergyType(input.energyType);
  const consumption = num(input.consumptionKwh);
  if (!/^\d{5}$/.test(postalCode)) throw new Error('Gültige fünfstellige PLZ erforderlich.');
  if (consumption === null || consumption <= 0) throw new Error('Gültiger Jahresverbrauch erforderlich.');

  const matches = tariffs
    .filter(isVisibleAndVerified)
    .filter(t => normalizeEnergyType(t.energyType || t.energy_type) === energyType)
    .filter(t => String(t.postalArea || t.postalCode || '').split(/[,;\s]+/).includes(postalCode) || String(t.postalArea || t.postalCode || '') === postalCode)
    .filter(t => inConsumptionRange(t, consumption))
    .map(t => {
      const costs = calculateAnnualCosts(t, consumption);
      return {
        ...t,
        costs,
        verificationRank: VERIFICATION_RANK[String(t.verificationStatus || t.publicStatus || '').toLowerCase()] ?? 0,
      };
    })
    .sort((a, b) => a.costs.firstYearCost - b.costs.firstYearCost || b.verificationRank - a.verificationRank);

  return matches;
}

export function buildComparisonSummary(currentTariff, selectedTariff, consumption) {
  if (!selectedTariff) return null;
  const newCosts = selectedTariff.costs || calculateAnnualCosts(selectedTariff, consumption);
  const currentCosts = currentTariff
    ? calculateAnnualCosts(currentTariff, consumption)
    : null;

  return {
    current: currentCosts,
    selected: newCosts,
    savingsFirstYear: currentCosts ? round2(currentCosts.recurringAnnualCost - newCosts.firstYearCost) : null,
    savingsOngoing: currentCosts ? round2(currentCosts.recurringAnnualCost - newCosts.ongoingYearCost) : null,
  };
}

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
