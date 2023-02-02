import hsdLedger from 'hsd-ledger';

const MTX = require('hsd/lib/primitives/mtx');
const {LedgerHSD} = hsdLedger;
const {Device} = hsdLedger.HID;
const ONE_MINUTE = 60000;

export async function withLedger(network, action) {
  let device;
  let ledger;

  try {
    device = await Device.requestDevice();
    device.set({
      timeout: ONE_MINUTE
    });

    await device.open();
    ledger = new LedgerHSD({device, network});
  } catch (e) {
    console.error('failed to open ledger', e);
    throw e;
  }

  try {
    return await action(ledger);
  } finally {
    try {
      await device.close();
    } catch (e) {
      console.error('failed to close ledger', e);
    }
  }
}

export async function getXPub(network) {
  return withLedger(network, async (ledger) => {
    return (await ledger.getAccountXPUB(0)).xpubkey(network);
  });
}

export async function getAppVersion(network) {
  return withLedger(network, async (ledger) => {
    return ledger.getAppVersion();
  });
}

const sName = 'Ledger';
const methods = {
  getXPub,
  getAppVersion
};

export function start(server) {
  server.withService(sName, methods);
}
