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

function statusOf(tariff) {
  return String(tariff.verificationStatus || tariff.publicStatus || '').toLowerCase();
}

function isVisibleAndVerified(tariff) {
  const status = statusOf(tariff);
  return status !== 'hidden' && (VERIFICATION_RANK[status] ?? 0) >= 2;
}

function inConsumptionRange(tariff, consumption) {
  const min = num(tariff.minConsumptionKwh ?? tariff.min_consumption_kwh);
  const max = num(tariff.maxConsumptionKwh ?? tariff.max_consumption_kwh);
  if (min !== null && consumption < min) return false;
  if (max !== null && consumption > max) return false;
  return true;
}

function noticePeriodDays(tariff) {
  const explicit = num(tariff.kuendigungsfrist_tage ?? tariff.noticePeriodDays);
  if (explicit !== null) return explicit;
  const text = String(tariff.noticePeriod || '').toLowerCase();
  if (text.includes('2 wochen')) return 14;
  if (text.includes('4 wochen')) return 28;
  if (text.includes('1 monat')) return 30;
  if (text.includes('6 wochen')) return 42;
  return null;
}

function hasValidSourceAndDate(tariff) {
  const source = tariff.quelle ?? tariff.source;
  const date = tariff.datenstand ?? tariff.data_as_of ?? tariff.dataAsOf;
  return Boolean(source && date);
}

export function validateTariffLegalFields(tariff) {
  const errors = [];
  const warnings = [];
  const noticeDays = noticePeriodDays(tariff);
  const grundversorgung = tariff.grundversorgung === true || tariff.tariffType === 'grundversorgung';

  if (!hasValidSourceAndDate(tariff)) {
    warnings.push('Quelle und Datenstand fehlen; Tarif darf nicht als vollständig verifiziert dargestellt werden.');
  }

  if (noticeDays !== null && noticeDays > 30 && !grundversorgung) {
    errors.push('Kündigungsfrist vor Ablauf der Erstlaufzeit darf bei Verbraucherverträgen nicht länger als einen Monat sein.');
  }

  const extensionMonths = num(tariff.verlaengerung_monate) ?? 0;
  const anytime = tariff.verlaengerung_kuendbar_jederzeit;
  const extensionNoticeDays = num(tariff.verlaengerung_kuendigungsfrist_tage);
  if (extensionMonths > 0 && anytime !== true) {
    errors.push('Eine feste Vertragsverlängerung ist nicht automatisch zulässig. Ohne jederzeitige Kündbarkeit mit höchstens einem Monat Frist muss der Tarif vor Veröffentlichung gesperrt werden.');
  }
  if (extensionNoticeDays !== null && extensionNoticeDays > 30) {
    errors.push('Kündigungsfrist während der Verlängerung darf nicht länger als einen Monat sein.');
  }

  if (tariff.preisgarantie_ausnahmen && !tariff.preisgarantie_ausnahmen_quelle) {
    errors.push('Preisgarantie-Ausnahmen müssen aus den konkreten Vertragsbedingungen des Anbieters belegt werden.');
  }

  if (grundversorgung && noticeDays !== null && noticeDays !== 14) {
    errors.push('Grundversorgung muss mit 14 Tagen Kündigungsfrist abgebildet werden.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    noticePeriodDays: noticeDays,
    terminationForm: grundversorgung ? 'Textform' : 'vertraglich / gesetzlich prüfen',
  };
}

export function calculateAnnualCosts(tariff, consumption, options = {}) {
  const kwh = num(consumption);
  if (kwh === null || kwh <= 0) throw new Error('Verbrauch muss größer als 0 sein.');

  const energyType = normalizeEnergyType(tariff.energyType || tariff.energy_type || (tariff.gasWorkPrice != null ? 'gas' : 'electricity'));
  const workPrice = num(tariff.workPriceCtKwh ?? tariff.electricityWorkPrice ?? tariff.gasWorkPrice);
  const basePrice = num(tariff.basePriceAnnual ?? tariff.electricityBasePriceAnnual ?? tariff.gasBasePriceAnnual) ?? 0;
  if (workPrice === null) throw new Error('Arbeitspreis des Tarifs fehlt.');

  let billableKwh = kwh;
  if (energyType === 'gas' && tariff.consumptionUnit === 'm3') {
    const conversion = num(tariff.m3ToKwhFactor);
    if (conversion === null || conversion <= 0) throw new Error('Für Gas mit m³-Verbrauch fehlt ein gültiger Umrechnungsfaktor.');
    billableKwh = kwh * conversion;
  }

  const energyCost = workPrice / 100 * billableKwh;
  const recurring = basePrice + energyCost;
  const newCustomerBonus = Math.max(0, num(tariff.newCustomerBonus ?? tariff.neukundenbonus) ?? 0);
  const instantBonus = Math.max(0, num(tariff.instantBonus ?? tariff.sofortbonus) ?? 0);
  const oneTimeBonus = newCustomerBonus + instantBonus;

  const firstYearCost = Math.max(0, recurring - oneTimeBonus);
  const ongoingYearCost = recurring;
  const legal = validateTariffLegalFields(tariff);

  return {
    energyType,
    consumptionKwh: kwh,
    billableKwh: round2(billableKwh),
    workPriceCtKwh: workPrice,
    basePriceAnnual: basePrice,
    recurringAnnualCost: round2(recurring),
    oneTimeBonus: round2(oneTimeBonus),
    firstYearCost: round2(firstYearCost),
    ongoingYearCost: round2(ongoingYearCost),
    bonusApplied: oneTimeBonus > 0,
    calculationBasis: options.includeBonus === false ? 'ongoing' : 'first_year',
    legalValidation: legal,
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
    .filter(t => normalizeEnergyType(t.energyType || t.energy_type || (t.gasWorkPrice != null ? 'gas' : 'electricity')) === energyType)
    .filter(t => String(t.postalArea || t.postalCode || '').split(/[,;\s]+/).includes(postalCode))
    .filter(t => inConsumptionRange(t, consumption))
    .map(t => {
      const costs = calculateAnnualCosts(t, consumption);
      return {
        ...t,
        costs,
        legalValidation: costs.legalValidation,
        verificationRank: VERIFICATION_RANK[statusOf(t)] ?? 0,
      };
    })
    .filter(t => t.legalValidation.valid)
    .sort((a, b) => a.costs.firstYearCost - b.costs.firstYearCost || b.verificationRank - a.verificationRank);

  return matches;
}

export function buildComparisonSummary(currentTariff, selectedTariff, consumption) {
  if (!selectedTariff) return null;
  const newCosts = selectedTariff.costs || calculateAnnualCosts(selectedTariff, consumption);
  const currentCosts = currentTariff ? calculateAnnualCosts(currentTariff, consumption, { includeBonus: false }) : null;

  return {
    current: currentCosts,
    selected: newCosts,
    savingsFirstYear: currentCosts ? round2(currentCosts.recurringAnnualCost - newCosts.firstYearCost) : null,
    savingsOngoing: currentCosts ? round2(currentCosts.recurringAnnualCost - newCosts.ongoingYearCost) : null,
  };
}

export function buildTerminationInfo(tariff, referenceDate = new Date()) {
  const legal = validateTariffLegalFields(tariff);
  const grundversorgung = tariff.grundversorgung === true || tariff.tariffType === 'grundversorgung';
  return {
    noticePeriodDays: grundversorgung ? 14 : legal.noticePeriodDays,
    form: grundversorgung ? 'Textform' : 'vertraglich / gesetzlich prüfen',
    anytime: grundversorgung,
    referenceDate: referenceDate.toISOString().slice(0, 10),
  };
}

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
