import { BigNumber } from 'bignumber.js';

const DECIMALS = 6;
const UNIT_DIVISOR = 1000000;

export function displayBalance(bal) {
  return new BigNumber(bal).div(UNIT_DIVISOR).toFixed(DECIMALS);
}

export function toBaseUnits(bal) {
  return new BigNumber(bal).times(UNIT_DIVISOR).toFixed(0);
}
