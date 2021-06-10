import hsdLedger from 'hsd-ledger';

const MTX = require('hsd/lib/primitives/mtx');
const {LedgerHSD} = hsdLedger;
const {Device} = hsdLedger.USB;
const ONE_MINUTE = 60000;

export async function withLedger(network, action) {
  let device;
  let ledger;

  try {
    await Device.requestDevice();
    const devices = await Device.getDevices();
    device = devices[0];
    device.set({
      timeout: ONE_MINUTE
    });
    if (!Device.isLedgerDevice(device))
      throw new Error('Device should be a Ledger device.');

    await device.open();
    // TODO: this network parameter should be passed dynamically.
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
