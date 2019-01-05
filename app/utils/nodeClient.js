import { NodeClient } from 'hs-client';

const Network = require('hsd/lib/protocol/network');

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

  const nodeClient = new NodeClient(walletOptions);

  const ret = {
    getInfo: async () => {
      return nodeClient.getInfo();
    }
  };
  clientPool[net] = ret;
  return ret;
}
