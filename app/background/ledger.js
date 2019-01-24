import hnsLedger from 'hns-ledger';
import * as logger from './logger/logger';
import { defaultServer, makeClient } from './ipc';

const MTX = require('hsd/lib/primitives/mtx');
const Coin = require('hsd/lib/primitives/coin');
const {LedgerHSD, LedgerInput} = hnsLedger;
const {Device} = hnsLedger.HID;
const ONE_MINUTE = 60000;

export async function withLedger(action) {
  let device;
  let ledger;

  try {
    const devices = await Device.getDevices();
    device = new Device({
      device: devices[0],
      timeout: ONE_MINUTE
    });
    await device.open();
    ledger = new LedgerHSD({ device, network: 'simnet' });
  } catch (e) {
    logger.error('failed to open ledger', e);
    throw e;
  }

  try {
    return await action(ledger);
  } finally {
    try {
      await device.close()
    } catch (e) {
      logger.error('failed to close ledger', e);
    }
  }
}

export async function getXPub() {
  return withLedger(async (ledger) => {
    return (await ledger.getAccountXpub(0)).xpubkey('simnet');
  });
}

export async function signTransaction(txJSON) {
  const mtx = MTX.fromJSON(txJSON);

  return withLedger(async (ledger) => {
    const retMTX = await ledger.signTransaction(mtx);

    try {
      retMTX.check();
    } catch (e) {
      logger.error('transaction failed to verify:' + e.message);
      throw e
    }

    return retMTX
  });
}

const sName = 'Ledger';
const methods = {
  getXPub,
  signTransaction
};

export const clientStub = (ipcRendererInjector) => makeClient(ipcRendererInjector, sName, Object.keys(methods));
defaultServer.withService(sName, methods);
