import { WalletClient } from 'hs-client';
import { clientStub as nodeClientStub } from '../background/node';
import { clientStub as ledgerClientStub } from '../background/ledger';
import { displayBalance, toBaseUnits } from './balances';
import { delUnlockReceiveAddress, getUnlockReceiveAddress, setUnlockReceiveAddress } from '../db/system';
import * as nodeClient from './nodeClient';
import { awaitLedger } from '../ducks/ledgerManager';

const node = nodeClientStub(() => require('electron').ipcRenderer);
const ledger = ledgerClientStub(() => require('electron').ipcRenderer);
const MasterKey = require('hsd/lib/wallet/masterkey');
const Network = require('hsd/lib/protocol/network');
const Mnemonic = require('hsd/lib/hd/mnemonic');

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
  const nClient = nodeClient.forNetwork(net);

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

    createNewWallet: async (passphraseOrXPub, isLedger) => {
      await ret.reset();

      if (isLedger) {
        const res = await walletClient.createWallet(WALLET_ID, {
          watchOnly: true,
          accountKey: passphraseOrXPub
        });
        wallet = walletClient.wallet(WALLET_ID);
        return res;
      }

      const mnemonic = new Mnemonic({bits: 256});
      const options = {
        passphrase: passphraseOrXPub,
        witness: false,
        watchOnly: false,
        mnemonic: mnemonic.getPhrase(),
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
      await walletClient.rescan(0);
      return res;
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

    reset: async () => {
      await delUnlockReceiveAddress(net);
      return node.reset();
    },
  };

  // switches between implementations depending on whether
  // or not the current wallet requires a ledger.
  function ledgerFacade(onLedger, onNonLedger) {
    return async (...args) => {
      const info = await ret.getWalletInfo();

      if (info.watchOnly) {
        return onLedger(...args);
      }

      return onNonLedger(...args);
    }
  }

  // convenience method that throws an error for
  // implementations that ledger doesn't support.
  function disabledForLedger(message, onNonLedger) {
    return ledgerFacade(() => {
      throw new Error(message);
    }, onNonLedger);
  }

  ret.getMasterHDKey = disabledForLedger('cannot get HD key for watch-only wallet', () => wallet.getMaster());
  ret.setPassphrase = disabledForLedger('cannot set passphrase for watch-only wallet', (newPass) => wallet.setPassphrase(newPass));
  ret.revealSeed = disabledForLedger('cannot reveal seed phrase for watch-only wallet', async (passphrase) => {
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
  });

  async function sendLedger(to, amount, fee) {
    await walletClient.execute('selectwallet', [WALLET_ID]);
    // TODO: fee
    const ret = await walletClient.execute('createsendtoaddress', [to, Number(amount), '', '', false, 'default']);
    return awaitLedger(async () => {
      const tx = await ledger.signTransaction(ret);
      return await nClient.broadcastRawTx(tx.hex);
    });
  }

  ret.send = ledgerFacade(sendLedger, async (to, amount, fee) => {
    return wallet.send({
      rate: Number(toBaseUnits(fee)),
      outputs: [{
        value: Number(toBaseUnits(amount)),
        address: to
      }]
    });
  });
  ret.lock = ledgerFacade(() => null, () => wallet.lock());
  ret.unlock = ledgerFacade(() => null, (passphrase) => wallet.unlock(passphrase, 3600));
  ret.isLocked = ledgerFacade(() => false, async () => {
    let addr = await getUnlockReceiveAddress(net);
    if (!addr) {
      addr = (await wallet.createAddress('default')).address;
      await setUnlockReceiveAddress(net, addr);
    }

    try {
      await walletClient.execute('selectwallet', [WALLET_ID]);
      await walletClient.execute('signmessage', [addr, Date.now().toString()]);
    } catch (e) {
      if (e.message.match(/wallet is locked/i)) {
        return true;
      }

      if (e.message.match(/address not found/i)) {
        await setUnlockReceiveAddress(net, '');
        return ret.isLocked();
      }

      throw e;
    }

    return false;
  });

  clientPool[net] = ret;
  window.beep = ret;
  return ret;
}
