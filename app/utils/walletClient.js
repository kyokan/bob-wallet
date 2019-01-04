import { WalletClient } from 'hs-client';
import { clientStub } from '../background/node';

const client = clientStub(() => require('electron').ipcRenderer);
const Network = require('hsd/lib/protocol/network');

const network = Network.get('simnet');

const DEFAULT_ID = 'default';

const walletOptions = {
  network: network.type,
  port: network.walletPort,
  apiKey: 'api-key'
};
const walletClient = new WalletClient(walletOptions);

export const getWalletInfo = async () => {
  const wallet = walletClient.wallet(DEFAULT_ID);
  const result = await wallet.getInfo();
  return result;
};

export const createNewWallet = async passphrase => {
  const options = {
    passphrase,
    witness: false,
    watchOnly: false
    // accountKey: 'spubKBAoFrCN1HzSEDye7jcQaycA8L7MjFGmJD1uuvUZ21d9srAmAxmB7o1tCZRyXmTRuy5ZDQDV6uxtcxfHAadNFtdK7J6RV9QTcHTCEoY5FtQD'
  };
  // await deleteWallet();
  const result = await walletClient.createWallet(DEFAULT_ID, options);
  return result;
};

export const importSeed = async (passphrase, mnemonic) => {
  const options = {
    passphrase,
    witness: false,
    watchOnly: false,
    mnemonic
    // accountKey: 'spubKBAoFrCN1HzSEDye7jcQaycA8L7MjFGmJD1uuvUZ21d9srAmAxmB7o1tCZRyXmTRuy5ZDQDV6uxtcxfHAadNFtdK7J6RV9QTcHTCEoY5FtQD'
  };
  // await deleteWallet();
  const result = await walletClient.createWallet(DEFAULT_ID, options);
  return result;
};

// note: returns mnemonic phrases if wallet is unencrypted
export const getMasterHDKey = async () => {
  const wallet = walletClient.wallet(DEFAULT_ID);
  const result = await wallet.getMaster();
  return result;
};

export const createPassphrase = async newPass => {
  const wallet = walletClient.wallet(DEFAULT_ID);
  const result = await wallet.setPassphrase(newPass);
  return result;
};

export const changePassphrase = async (oldPass, newPass) => {
  const wallet = walletClient.wallet(DEFAULT_ID);
  const result = await wallet.setPassphrase(oldPass, newPass);
  return result;
};

export const generateReceivingAddress = async (account = 'default') => {
  const wallet = walletClient.wallet(DEFAULT_ID);
  const result = await wallet.createAddress(account);
  return result;
};

// note: address / receivingAddress === bech32 encoded address
export const getPublicKeyByAddress = async address => {
  const wallet = walletClient.wallet(DEFAULT_ID);
  const result = await wallet.getKey(address);
  return result;
};

export const getPrivateKeyByAddress = async (address, passphrase) => {
  const wallet = walletClient.wallet(DEFAULT_ID);
  const result = await wallet.getWIF(address, passphrase);
  return result;
};

// todo: delete wallet
export const deleteWallet = async () => {
  // WIP: Not working yet
  await client.reset();
};
