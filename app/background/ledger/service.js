import hsdLedger from 'hsd-ledger';

const MTX = require('hsd/lib/primitives/mtx');
const {LedgerHSD} = hsdLedger;
const {Device} = hsdLedger.USB;
const ONE_MINUTE = 60000;

export async function withLedger(network, action) {
  let device;
  let ledger;

  try {
    const devices = await Device.getDevices();
    device = new Device({
      device: devices[0],
      timeout: ONE_MINUTE,
    });
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

const sName = 'Ledger';
const methods = {
  getXPub,
};

export function start(server) {
  server.withService(sName, methods);
}
