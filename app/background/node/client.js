import { makeClient } from '../ipc/ipc';

export const clientStub = ipcRendererInjector => makeClient(ipcRendererInjector, 'Node', [
  'start',
  'stop',
  'reset',
  'generateToAddress',
  'getAPIKey',
  'getInfo',
  'getNameInfo',
  'getTXByAddresses',
  'getNameByHash',
  'getAuctionInfo',
  'getBlockByHeight',
  'getTx',
  'validateExchangeTransferTx',
  'broadcastRawTx',
  'sendRawAirdrop',
  'getFees',
  'getAverageBlockTime',
  'getCoin'
]);
