// Timer-backed MessageChannel for React's browser scheduler in the Node/jsdom
// test bundle. Native Node ports otherwise keep the process alive after unmount.
globalThis.MessageChannel = class {
  constructor() {
    this.port1 = {onmessage: null};
    this.port2 = {postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0)};
  }
};
const nodeCrypto = eval('require')('crypto');
const { configure } = require('enzyme');
const Adapter = require('@cfaester/enzyme-adapter-react-18');

const cryptoShim = {
  getRandomValues(array) {
    return nodeCrypto.randomFillSync(array);
  },
};

for (const target of [globalThis, globalThis.window, globalThis.self]) {
  if (target && !target.crypto) {
    Object.defineProperty(target, 'crypto', {
      configurable: true,
      value: cryptoShim,
    });
  } else if (target && !target.crypto.getRandomValues) {
    Object.defineProperty(target.crypto, 'getRandomValues', {
      configurable: true,
      value: cryptoShim.getRandomValues,
    });
  }
}

configure({ adapter: new Adapter.default() });

window.bobElectron = {
  ipc: {send() {}, on() { return 1; }, off() {}},
  shell: {openExternal() { return Promise.resolve(false); }},
  dialog: {
    showOpenDialog() { return Promise.resolve({canceled: true, filePaths: []}); },
    showOpenDialogSync() { return undefined; },
    showSaveDialogSync() { return undefined; },
  },
  files: {
    readFile() { return Promise.reject(new Error('No test file selected.')); },
    readFileSync() { throw new Error('No test file selected.'); },
    writeFile() { return Promise.resolve(true); },
  },
  app: {isPackaged: false, getPath() { return null; }},
};

require('./app/pages/Auction/tests/RepairBid.spec');
require('./app/pages/MyDomain/tests/Records.spec');
require('./app/background/wallet/tests/liquidityHtlc.spec');
require('./app/background/wallet/tests/registerValidation.spec');
require('./app/background/wallet/tests/basketValidation.spec');
require('./app/background/wallet/tests/registerAll.spec');
require('./app/components/RegisterAll/register-all.spec');
require('./app/background/wallet/tests/revealBatch.spec');
require('./app/background/wallet/tests/stats.spec');
require('./app/background/wallet/tests/transactionSafety.spec');
require('./app/background/hnsInvestments/tests/balanceSnapshot.spec');
require('./app/background/hnsInvestments/tests/nameSnapshot.spec');
require('./app/background/node/tests/spvHelper.spec');
require('./app/background/node/tests/clientLifecycle.spec');
require('./app/ducks/tests/nodeReducer.spec');
require('./app/deeplink/tests/index.spec');
require('./app/utils/tests/paidNameTransfer.spec');
require('./app/utils/tests/shakedexListingAction.spec');
require('./app/utils/tests/marketplaceAuctions.spec');
require('./app/utils/tests/marketplaceRequest.spec');
require('./app/pages/Exchange/tests/marketplaceSpv.spec');
require('./app/utils/tests/urlPolicy.spec');
require('./app/utils/tests/transactionNotifications.spec');
require('./app/utils/tests/activateProposal.spec');
require('./app/utils/tests/auctionBasketData.spec');
require('./app/background/ipc/tests/ipc.spec');
require('./app/background/hip2/tests/alias.spec');
require('./app/background/hip2/tests/port.spec');
require('./app/components/AddressInput/tests/index.spec');
require('./app/background/storage/tests/health.spec');
require('./app/components/SyncStatus/tests/index.spec');
require('./app/ducks/tests/storageReducer.spec');
require('./app/ducks/tests/walletActions.spec');
require('./app/ducks/tests/pendingTransactions.spec');
require('./app/ducks/tests/nameRequestLifecycle.spec');
require('./app/ducks/tests/namesAuctionBasket.spec');
require('./app/ducks/tests/walletStats.spec');
require('./app/utils/tests/auctionDomain.spec');
require('./app/utils/tests/nameDisplay.spec');

require('./app/background/node/tests/spvHelperRequest.spec');

require("./app/ducks/tests/nameUpdateReview.spec");
require('./app/pages/AuctionBasket/tests/localization.spec');
require('./app/utils/tests/localeFormatting.spec');
require('./app/utils/tests/secureRandom.spec');

require("./app/utils/tests/reviewText.spec");

require('./app/pages/Addons/tests/catalog.spec');

require('./app/background/wallet/tests/localRescan.spec');
require('./app/background/wallet/tests/recoveryAdmission.spec');
require('./app/components/LanguagePicker/LanguagePicker.spec');
