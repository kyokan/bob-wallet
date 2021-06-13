import { clientStub as nodeClientStub } from '../background/node/client';

const node = nodeClientStub(() => require('electron').ipcRenderer);

const nodeClient = {
  verifyMessageWithName: async (name, signature, message) => {
    return node.verifyMessageWithName(name, signature, message);
  },

  getCoin: async (hash, index) => {
    return node.getCoin(hash, index);
  },

  getInfo: async () => {
    return node.getInfo();
  },

  getFees: async () => {
    return node.getFees();
  },

  getNameInfo: async (name) => {
    return node.getNameInfo(name);
  },

  getNameByHash: async (hash) => {
    return node.getNameByHash(hash);
  },

  getAuctionInfo: async (name) => {
    return node.getAuctionInfo(name);
  },

  getBlockByHeight: async (height, verbose, details) => {
    return node.getBlockByHeight(height, verbose, details);
  },

  getTx: async (hash) => {
    return node.getTx(hash);
  },

  broadcastRawTx: async (tx) => {
    return node.broadcastRawTx(tx);
  },

  sendRawAirdrop: async (data) => {
    return node.sendRawAirdrop(data);
  },

  stop: async () => {
    return node.stop();
  },
};

export default nodeClient;
