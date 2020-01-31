import { WalletClient } from 'hs-client';
import { clientStub as nodeClientStub } from '../background/node/client';
import { clientStub as ledgerClientStub } from '../background/ledger/client';
import { displayBalance, toBaseUnits } from './balances';
import nodeClient from './nodeClient';
import { awaitLedger } from '../ducks/ledgerManager';

const node = nodeClientStub(() => require('electron').ipcRenderer);
const ledger = ledgerClientStub(() => require('electron').ipcRenderer);
const MasterKey = require('hsd/lib/wallet/masterkey');
const Network = require('hsd/lib/protocol/network');
const Mnemonic = require('hsd/lib/hd/mnemonic');
const MTX = require('hsd/lib/primitives/mtx');

const WALLET_ID = 'allison';

let walletClient;
let wallet;
let didSelectWallet;
let pendingSelection;
let currentNetwork;

const nClient = nodeClient;

export function setClient(net, apiKey) {
  const network = Network.get(net);
  const walletOptions = {
    network: network.type,
    port: network.walletPort,
    apiKey,
  };
  currentNetwork = net;

  walletClient = new WalletClient(walletOptions);
  wallet = walletClient.wallet(WALLET_ID);
  didSelectWallet = false;
}

async function selectWallet() {
  if (didSelectWallet) {
    return;
  }

  if (pendingSelection) {
    await pendingSelection;
    return;
  }

  pendingSelection = walletClient.execute('selectwallet', [WALLET_ID]);
  await pendingSelection;
  didSelectWallet = true;
}

// switches between implementations depending on whether
// or not the current wallet requires a ledger.
function ledgerFacade(onLedger, onNonLedger, shouldConfirmLedger = true) {
  return async (...args) => {
    const info = await client.getWalletInfo();

    if (info.watchOnly) {
      const res = await onLedger(...args);
      if (shouldConfirmLedger) {
        const mtx = MTX.fromJSON(res);
        return awaitLedger(mtx.txid(), async () => {
          const tx = await ledger.signTransaction(net, res);
          return await nClient.broadcastRawTx(tx.hex);
        });
      }

      return res;
    }

    return onNonLedger(...args);
  };
}

// convenience method that throws an error for
// implementations that ledger doesn't support.
function disabledForLedger(message, onNonLedger) {
  return ledgerFacade(() => {
    throw new Error(message);
  }, onNonLedger, false);
}

async function sendLedger(to, amount, fee) {
  await selectWallet();
  // TODO: fee
  return walletClient.execute('createsendtoaddress', [to, Number(amount), '', '', false, 'default']);
}

const client = {
  getWalletInfo: async () => {
    return wallet.getInfo();
  },

  getAccountInfo: async () => {
    return wallet.getAccount('default');
  },

  getCoin: async (hash, index) => {
    return wallet.getCoin(hash, index);
  },

  getNames: async () => {
    await selectWallet();
    return walletClient.execute('getnames');
  },

  createNewWallet: async (passphraseOrXPub, isLedger) => {
    await client.reset();

    if (isLedger) {
      const res = await walletClient.createWallet(WALLET_ID, {
        watchOnly: true,
        accountKey: passphraseOrXPub,
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
    await client.reset();
    const options = {
      passphrase,
      // hsd generates different keys for
      // menmonics with trailing whitespace
      mnemonic: mnemonic.trim(),
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
    await selectWallet();
    return walletClient.execute('getauctioninfo', [name]);
  },

  getTransactionHistory: async () => {
    return wallet.getHistory('default');
  },

  getPendingTransactions: async () => {
    return wallet.getPending('default');
  },

  getBids: async () => {
    await selectWallet();
    return walletClient.execute('getbids');
  },

  sendRawAirdrop: async (data) => {
    await nClient.sendRawAirdrop(data);
  },

  reset: async () => {
    return node.reset();
  },

  getMasterHDKey: disabledForLedger('cannot get HD key for watch-only wallet', () => wallet.getMaster()),

  setPassphrase: disabledForLedger('cannot set passphrase for watch-only wallet', (newPass) => wallet.setPassphrase(newPass)),

  revealSeed: disabledForLedger('cannot reveal seed phrase for watch-only wallet', async (passphrase) => {
    const data = await client.getMasterHDKey();

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
      p: data.p,
    };

    const mk = new MasterKey(parsedData);
    await mk.unlock(passphrase, 100);
    return mk.mnemonic.getPhrase();
  }),

  sendOpen: ledgerFacade(async (name) => {
    await selectWallet();
    return walletClient.execute('createopen', [name]);
  }, async (name) => {
    await selectWallet();
    return walletClient.execute('sendopen', [name]);
  }),

  sendBid: ledgerFacade(async (name, amount, lockup) => {
    await selectWallet();
    return walletClient.execute('createbid', [name, Number(displayBalance(amount)), Number(displayBalance(lockup))]);
  }, async (name, amount, lockup) => {
    await selectWallet();
    await walletClient.execute('sendbid', [name, Number(displayBalance(amount)), Number(displayBalance(lockup))]);
  }),

  sendUpdate: ledgerFacade(async (name, json) => {
    await selectWallet();
    return walletClient.execute('createupdate', [name, json]);
  }, async (name, json) => {
    await selectWallet();
    await walletClient.execute('sendupdate', [name, json]);
  }),

  sendReveal: ledgerFacade(async (name) => {
    await selectWallet();
    return walletClient.execute('createreveal', [name]);
  }, async (name) => {
    await selectWallet();
    await walletClient.execute('sendreveal', [name]);
  }),

  sendRedeem: ledgerFacade(async (name) => {
    await selectWallet();
    return walletClient.execute('createredeem', [name]);
  }, async (name) => {
    await selectWallet();
    await walletClient.execute('sendredeem', [name]);
  }),

  sendRenewal: ledgerFacade(async (name) => {
    await selectWallet();
    return walletClient.execute('createrenewal', [name]);
  }, async (name) => {
    await selectWallet();
    await walletClient.execute('sendrenewal', [name]);
  }),

  send: ledgerFacade(sendLedger, async (to, amount, fee) => {
    return wallet.send({
      rate: Number(toBaseUnits(fee)),
      outputs: [{
        value: Number(toBaseUnits(amount)),
        address: to,
      }],
    });
  }),

  lock: ledgerFacade(() => null, () => wallet.lock()),

  unlock: ledgerFacade(() => null, (passphrase) => wallet.unlock(passphrase, 3600), false),

  isLocked: ledgerFacade(() => false, async () => {
    try {
      const info = await wallet.getInfo();
      return info === null || info.master.until === 0;
    } catch (e) {
      console.error(e);
      return true;
    }
  }, false),
};

export default client;
