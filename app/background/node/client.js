import { makeClient } from '../ipc/ipc';

export const clientStub = ipcRendererInjector => makeClient(ipcRendererInjector, 'Node', [
  'start',
  'stop',
  'reset',
  'getAPIKey',
  'getInfo',
  'getNameInfo',
  'getNameByHash',
  'getAuctionInfo',
  'getBlockByHeight',
  'getTx',
  'broadcastRawTx',
  'sendRawAirdrop',
  'getFees',
  'getAverageBlockTime',
  'finalizeWithPayment',
  'claimPaidTransfer'
]);
