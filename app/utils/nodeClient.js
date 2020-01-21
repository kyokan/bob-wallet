import { NodeClient } from 'hs-client';
import { BigNumber } from 'bignumber.js';

const Network = require('hsd/lib/protocol/network');

const MIN_FEE = new BigNumber(0.001);

let nodeClient;

export function setClient(net, apiKey) {
  const network = Network.get(net);
  const networkOptions = {
    network: network.type,
    port: network.rpcPort,
    apiKey,
  };

  nodeClient = new NodeClient(networkOptions);
}

const client = {
  getInfo: async () => {
    return nodeClient.getInfo();
  },

  getFees: async () => {
    const slowRes = await nodeClient.execute('estimatesmartfee', [5]);
    const standardRes = await nodeClient.execute('estimatesmartfee', [2]);
    const fastRes = await nodeClient.execute('estimatesmartfee', [1]);
    const slow = BigNumber.max(new BigNumber(slowRes.fee), MIN_FEE).toFixed(6);
    const standard = BigNumber.max(new BigNumber(standardRes.fee), MIN_FEE).toFixed(6);
    const fast = BigNumber.max(new BigNumber(fastRes.fee), MIN_FEE).toFixed(6);

    return {
      slow,
      standard,
      fast,
    };
  },

  getNameInfo: async (name) => {
    return nodeClient.execute('getnameinfo', [name]);
  },

  getNameByHash: async (hash) => {
    return nodeClient.execute('getnamebyhash', [hash]);
  },

  getAuctionInfo: async (name) => {
    return nodeClient.execute('getauctioninfo', [name]);
  },

  getBlockByHeight: async (height, verbose, details) => {
    return nodeClient.execute('getblockbyheight', [height, verbose ? 1 : 0, details ? 1 : 0]);
  },

  getTx: async (hash) => {
    return nodeClient.getTX(hash);
  },

  broadcastRawTx: async (tx) => {
    return nodeClient.execute('sendrawtransaction', [tx]);
  },

  sendRawAirdrop: async (data) => {
    return nodeClient.execute('sendrawairdrop', data);
  },

  stop: async () => {
    return nodeClient.execute('stop');
  },
};

export default client;
