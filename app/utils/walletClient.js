import { WalletClient } from 'hs-client';
const Network = require('hsd/lib/protocol/network');

const network = Network.get('simnet');

const walletOptions = {
  network: network.type,
  port: network.walletPort,
  apiKey: 'api-key'
};
const walletClient = new WalletClient(walletOptions);

export const createNewWallet = async (id, passphrase) => {
  const options = {
    passphrase: passphrase,
    witness: false,
    watchOnly: false
    // accountKey: 'spubKBAoFrCN1HzSEDye7jcQaycA8L7MjFGmJD1uuvUZ21d9srAmAxmB7o1tCZRyXmTRuy5ZDQDV6uxtcxfHAadNFtdK7J6RV9QTcHTCEoY5FtQD'
  };
  const result = await walletClient.createWallet(id, options);
  return result;
};

// note: returns mnemonic phrases if wallet is unencrypted
export const getMasterHDKey = async id => {
  const wallet = walletClient.wallet(id);
  const result = await wallet.getMaster();
  return result;
};

export const createPassphrase = async (id, newPass) => {
  const wallet = walletClient.wallet(id);
  const result = await wallet.setPassphrase(newPass);
  return result;
};

export const changePassphrase = async (id, oldPass, newPass) => {
  const wallet = walletClient.wallet(id);
  const result = await wallet.setPassphrase(oldPass, newPass);
  return result;
};

export const generateReceivingAddress = async (id, account = 'default') => {
  const wallet = walletClient.wallet(id);
  const result = await wallet.createAddress(account);
  return result;
};

// note: address / receivingAddress === bech32 encoded address
export const getPublicKeyByAddress = async (id, address) => {
  const wallet = walletClient.wallet(id);
  const result = await wallet.getKey(address);
  return result;
};

export const getPrivateKeyByAddress = async (id, address, passphrase) => {
  const wallet = walletClient.wallet(id);
  const result = await wallet.getWIF(bech32EncodedAddress, passphrase);
  return result;
};
