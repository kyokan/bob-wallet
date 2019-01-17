import { WalletClient } from 'hs-client';
import { clientStub } from '../background/node';
import { displayBalance, toBaseUnits } from './balances';
import { getUnlockReceiveAddress, setUnlockReceiveAddress } from '../db/system';
import MasterKey from 'hsd/lib/wallet/masterkey';

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

    getCoin: async (hash, index) => {
      await walletClient.execute('selectwallet', [WALLET_ID]);
      return wallet.getCoin(hash, index);
    },

    getNames: async () => {
      await walletClient.execute('selectwallet', [WALLET_ID]);
      return walletClient.execute('getnames');
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

    revealSeed: async (passphrase) => {
      const data = await ret.getMasterHDKey();

      // should always be encrypted - seed cannot be revealed via the UI until
      // the user has finished onboarding. checking here for completeness' sake
      if (!data.encrypted) {
        return data.key.mnemonic.phrase;
      }

      const parsedData = {
        encrypted: data.encrypted,
        alg: data.algorithm,
        iv: Buffer.from(data.iv, 'hex'),
        ciphertext: Buffer.from(data.ciphertext, 'hex'),
        n: data.n,
        r: data.r,
        p: data.p
      };

      const mk = new MasterKey(parsedData);
      await mk.unlock(passphrase, 100);
      return mk.mnemonic.getPhrase();
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

    getAuctionInfo: async (name) => {
      await walletClient.execute('selectwallet', [WALLET_ID]);
      return walletClient.execute('getauctioninfo', [name]);
    },

    getTransactionHistory: async () => {
      return wallet.getHistory('default');
    },

    getPendingTransactions: async () => {
      return wallet.getPending('default');
    },

    getBids: async () => {
      await walletClient.execute('selectwallet', [WALLET_ID]);
      return walletClient.execute('getbids');
    },

    send: async (to, amount, fee) => {
      return wallet.send({
        rate: Number(toBaseUnits(fee)),
        outputs: [{
          value: Number(toBaseUnits(amount)),
          address: to
        }]
      });
    },

    sendOpen: async (name) => {
      await walletClient.execute('selectwallet', [WALLET_ID]);
      return walletClient.execute('sendopen', [name]);
    },

    sendBid: async (name, amount, lockup) => {
      await walletClient.execute('selectwallet', [WALLET_ID]);
      await walletClient.execute('sendbid', [name, Number(displayBalance(amount)), Number(displayBalance(lockup))]);
    },

    sendUpdate: async (name, json) => {
      await walletClient.execute('selectwallet', [WALLET_ID]);
      await walletClient.execute('sendupdate', [name, json]);
    },

    sendReveal: async (name) => {
      await walletClient.execute('selectwallet', [WALLET_ID]);
      await walletClient.execute('sendreveal', [name]);
    },

    sendRedeem: async (name) => {
      await walletClient.execute('selectwallet', [WALLET_ID]);
      await walletClient.execute('sendredeem', [name]);
    },

    sendRenewal: async (name) => {
      await walletClient.execute('selectwallet', [WALLET_ID]);
      await walletClient.execute('sendrenewal', [name]);
    },

    lock: async () => {
      return wallet.lock();
    },

    unlock: async (passphrase) => {
      return wallet.unlock(passphrase, 0);
    },

    reset: async () => {
      return client.reset();
    },

    isLocked: async () => {
      let addr = await getUnlockReceiveAddress();
      if (!addr) {
        addr = (await wallet.createAddress('default')).address;
        await setUnlockReceiveAddress(addr);
      }

      try {
        await walletClient.execute('selectwallet', [WALLET_ID]);
        await walletClient.execute('signmessage', [addr, Date.now().toString()]);
      } catch (e) {
        if (e.message.match(/wallet is locked/i)) {
          return true;
        }

        throw e;
      }

      return false;
    }
  };
  clientPool[net] = ret;
  window.beep = ret;
  return ret;
}
