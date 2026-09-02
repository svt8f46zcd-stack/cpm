import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAnnualCosts, filterAndRankTariffs, validateTariffLegalFields } from '../js/tariff-engine.js';

const baseTariff = {
  postalArea: '55278',
  energyType: 'electricity',
  workPriceCtKwh: 30,
  basePriceAnnual: 180,
  publicStatus: 'verified',
  quelle: 'test',
  datenstand: '2026-09-02',
};

test('calculates recurring and first-year cost separately', () => {
  const result = calculateAnnualCosts({ ...baseTariff, newCustomerBonus: 100 }, 3400);
  assert.equal(result.recurringAnnualCost, 1200);
  assert.equal(result.firstYearCost, 1100);
  assert.equal(result.ongoingYearCost, 1200);
});

test('rejects consumer notice periods above one month', () => {
  const result = validateTariffLegalFields({ ...baseTariff, kuendigungsfrist_tage: 42 });
  assert.equal(result.valid, false);
});

test('rejects fixed extension without anytime cancellation', () => {
  const result = validateTariffLegalFields({
    ...baseTariff,
    verlaengerung_monate: 12,
    verlaengerung_kuendbar_jederzeit: false,
    verlaengerung_kuendigungsfrist_tage: 30,
  });
  assert.equal(result.valid, false);
});

test('ranks only verified and matching tariffs', () => {
  const offers = filterAndRankTariffs([
    { ...baseTariff, id: 'good', workPriceCtKwh: 29 },
    { ...baseTariff, id: 'unverified', workPriceCtKwh: 10, publicStatus: 'copied_unverified' },
    { ...baseTariff, id: 'other-plz', postalArea: '55100', workPriceCtKwh: 10 },
  ], { postalCode: '55278', energyType: 'electricity', consumptionKwh: 3400 });
  assert.deepEqual(offers.map(x => x.id), ['good']);
});
