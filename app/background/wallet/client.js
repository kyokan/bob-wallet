import { makeClient } from '../ipc/ipc';

export const clientStub = ipcRendererInjector => makeClient(ipcRendererInjector, 'Wallet', [
  'start',
  'getAPIKey',
  'setAPIKey',
  'getWalletInfo',
  'getAccountInfo',
  'getCoin',
  'getTX',
  'getNames',
  'createNewWallet',
  'importSeed',
  'generateReceivingAddress',
  'getAuctionInfo',
  'getTransactionHistory',
  'getPendingTransactions',
  'getBids',
  'getBlind',
  'getMasterHDKey',
  'hasAddress',
  'setPassphrase',
  'revealSeed',
  'estimateTxFee',
  'estimateMaxSend',
  'removeWalletById',
  'updateAccountDepth',
  'findNonce',
  'findNonceCancel',
  'encryptWallet',
  'backup',
  'rescan',
  'deepClean',
  'reset',
  'sendOpen',
  'sendBid',
  'sendRegister',
  'sendUpdate',
  'sendReveal',
  'sendRedeem',
  'sendRenewal',
  'sendRevealAll',
  'sendRedeemAll',
  'sendRegisterAll',
  'signMessageWithName',
  'transferMany',
  'finalizeMany',
  'renewMany',
  'sendTransfer',
  'cancelTransfer',
  'finalizeTransfer',
  'finalizeWithPayment',
  'claimPaidTransfer',
  'revokeName',
  'send',
  'lock',
  'unlock',
  'isLocked',
  'getNonce',
  'importNonce',
  'zap',
  'importName',
  'rpcGetWalletInfo',
  'listWallets',
  'getStats',
  'isReady',
  'createClaim',
  'sendClaim',
]);
