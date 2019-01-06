import { NodeClient } from 'hs-client';
import { BigNumber } from 'bignumber.js';

const Network = require('hsd/lib/protocol/network');

const clientPool = {};

const MIN_FEE = new BigNumber(0.001);

export function forNetwork(net) {
  if (clientPool[net]) {
    return clientPool[net];
  }

  const network = Network.get(net);
  const walletOptions = {
    network: network.type,
    port: network.rpcPort,
  };

  const nodeClient = new NodeClient(walletOptions);

  const ret = {
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
    }
  };
  clientPool[net] = ret;
  return ret;
}
