import { clientStub } from '../background/db';
const dbClient = clientStub(() => require('electron').ipcRenderer);


export async function getUnlockReceiveAddress() {
  return dbClient.get(unlockReceiveAddressKey());
}

export async function setUnlockReceiveAddress(addr) {
  return dbClient.put(unlockReceiveAddressKey(), addr);
}

function unlockReceiveAddressKey() {
  return 'unlock-receive-address';
}
