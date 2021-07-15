import { BigNumber } from 'bignumber.js';
import {consensus} from "hsd/lib/protocol";

const DECIMALS = 6;
const UNIT_DIVISOR = 1000000;

export function displayBalance(bal, withUnit, decimals = DECIMALS) {
  const ret = new BigNumber(bal).div(UNIT_DIVISOR).toFixed(decimals);
  return withUnit ? `${ret} HNS` : ret;
}

export function toBaseUnits(bal) {
  return new BigNumber(bal).times(UNIT_DIVISOR).toFixed(0);
}

export function toDisplayUnits(bal) {
  return new BigNumber(bal).div(UNIT_DIVISOR).toFixed(DECIMALS);
}
