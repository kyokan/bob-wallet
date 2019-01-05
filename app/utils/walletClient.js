import { WalletClient } from 'hs-client';
import { clientStub } from '../background/node';

const client = clientStub(() => require('electron').ipcRenderer);
const Network = require('hsd/lib/protocol/network');

const WALLET_ID = 'allison';

const clientPool = {};

export function forNetwork(net) {
  if (clientPool[net]) {
    return clientPool[net];
  }

  const network = Network.get(net);
  const walletOptions = {
    network: network.type,
    port: network.walletPort,
    apiKey: 'api-key'
  };

  const walletClient = new WalletClient(walletOptions);
  let wallet = walletClient.wallet(WALLET_ID);

  const ret = {
    getWalletInfo: async () => {
      return wallet.getInfo();
    },

    getAccountInfo: async () => {
      return wallet.getAccount('default');
    },

    createNewWallet: async (passphrase) => {
      await ret.reset();
      const options = {
        passphrase,
        witness: false,
        watchOnly: false
      };
      const res = await walletClient.createWallet(WALLET_ID, options);
      wallet = walletClient.wallet(WALLET_ID);
      return res;
    },

    importSeed: async (passphrase, mnemonic) => {
      await ret.reset();
      const options = {
        passphrase,
        witness: false,
        watchOnly: false,
        mnemonic
      };
      const res = await walletClient.createWallet(WALLET_ID, options);
      wallet = walletClient.wallet(WALLET_ID);
      return res;
    },

    getMasterHDKey: async () => {
      return wallet.getMaster();
    },

    setPassphrase: async (newPass) => {
      return wallet.setPassphrase(newPass);
    },

    generateReceivingAddress: async () => {
      return wallet.createAddress('default');
    },

    getPublicKeyByAddress: async (address) => {
      return wallet.getKey(address);
    },

    getPrivateKeyByAddress: async (address, passphrase) => {
      return wallet.getWIF(address, passphrase);
    },

    lock: async () => {
      return wallet.lock();
    },

    unlock: async (passphrase) => {
      return wallet.unlock(passphrase, 0);
    },

    reset: async () => {
      return client.reset();
    }
  };
  clientPool[net] = ret;
  return ret;
}
