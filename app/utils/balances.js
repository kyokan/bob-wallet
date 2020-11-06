import { BigNumber } from 'bignumber.js';
import {consensus} from "hsd/lib/protocol";

const DECIMALS = 6;
const UNIT_DIVISOR = 1000000;

export function displayBalance(bal, withUnit) {
  const ret = new BigNumber(bal).div(UNIT_DIVISOR).toFixed(DECIMALS);
  return withUnit ? `${ret} HNS` : ret;
}

export function toBaseUnits(bal) {
  return new BigNumber(bal).times(UNIT_DIVISOR).toFixed(0);
}

export function toDisplayUnits(bal) {
  return new BigNumber(bal).div(UNIT_DIVISOR).toFixed(DECIMALS);
}

export function parseFloatValue(val) {
  const value = val.match(/[0-9]*\.?[0-9]{0,6}/g)[0];
  if (Number.isNaN(parseFloat(value)))
    return;
  if (value * consensus.COIN > consensus.MAX_MONEY)
    return;
  return value;
}
