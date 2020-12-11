import { clientStub as walletClientStub } from '../background/wallet/client';
import { clientStub as nodeClientStub } from '../background/node/client';

const wallet = walletClientStub(() => require('electron').ipcRenderer);
const node = nodeClientStub(() => require('electron').ipcRenderer);

const walletClient = {
  sendRawAirdrop: async (data) => {
    return node.sendRawAirdrop(data);
  },

  reset: async () => {
    await wallet.reset();
    return node.reset();
  },

  ...wallet,
};

export default walletClient;
