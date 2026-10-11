import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Provider} from 'react-redux';
import {StaticRouter} from 'react-router-dom';
import {createMemoryHistory} from 'history';
import reducers from '../../app/ducks';
import {I18nContext, normalizeLocale, translateLocale} from '../../app/utils/i18n';
import zh from '../../locales/zh-CN.json';
import en from '../../locales/en.json';
import ru from '../../locales/ru-RU.json';
import th from '../../locales/th-TH.json';
import {AppHeader} from '../../app/pages/AppHeader';
import Login from '../../app/pages/AcountLogin';
import {Addons, ADDONS} from '../../app/pages/Addons';
import '../../app/pages/App/app.scss';
import '../../app/global.scss';
import Onboard from '../../app/pages/Onboarding/FundAccessOptions';
import ImportWarning from '../../app/pages/Onboarding/ImportSeedWarning';
import Backup from '../../app/pages/Onboarding/BackUpSeedWarning';
import Password from '../../app/pages/Onboarding/CreatePassword';
import Overview from '../../app/pages/Overview';
import BalanceSummary from '../../app/pages/Overview/BalanceSummary';
import Send from '../../app/components/SendModal';
import Receive from '../../app/components/ReceiveModal';
import Basket, {AuctionBasket} from '../../app/pages/AuctionBasket';
import {basketScope} from '../../app/utils/basketScope';
import OpenBasket from '../../app/pages/OpenBasket';
import Domains from '../../app/pages/DomainManager';
import Exchange, {Exchange as ExchangeScreen} from '../../app/pages/Exchange';
import Settings from '../../app/pages/Settings';
import RevealSeed from '../../app/pages/Settings/RevealSeedModal';
import {FinalizeWithPaymentModal} from '../../app/pages/MyDomain/FinalizeWithPaymentModal';
import {Records} from '../../app/components/Records';
import {RegisterAll} from '../../app/components/RegisterAll';
import '../../app/pages/MyDomain/my-domain.scss';

const query = new URLSearchParams(location.search);
const localeName = normalizeLocale(query.get('locale') || 'zh-CN');
const locale = {'en-US': en, 'zh-CN': zh, 'ru-RU': ru, 'th-TH': th}[localeName] || en;
document.documentElement.lang = localeName;
const shell = query.get('shell') === '1';
const dark = query.get('theme') === 'dark';
document.body.classList.toggle('bob-theme-dark', dark);
const noop = () => {};
const state = reducers(createMemoryHistory())(undefined, {type: 'fixture'});
Object.assign(state.wallet, {
  wid: 'fixture-only',
  type: 'standard',
  network: 'regtest',
  isLocked: false,
  initialized: true,
  balanceReady: true,
  wallets: ['fixture-only'],
  walletsDetails: {'fixture-only': {type: 'standard'}},
  receiveAddress: 'FIXTURE-NOT-A-VALID-ADDRESS',
  balance: {
    spendable: 100000000,
    confirmed: 100000000,
    unconfirmed: 100000000,
    lockedConfirmed: 0,
    lockedUnconfirmed: 0,
  },
});
Object.assign(state.node, {
  isRunning: true, spv: true, network: 'regtest',
  chain: {height: 1000, progress: 1},
  fees: {slow: 100, standard: 200, fast: 300},
});
Object.assign(state.app, {locale: localeName, customLocale: null, theme: dark ? 'dark' : 'light'});
state.walletStats.isLoading = false;
state.walletStats.status = 'ready';
for (const group of [state.walletStats.lockedBalance, state.walletStats.actionableInfo]) {
  for (const value of Object.values(group)) {
    for (const key of Object.keys(value)) value[key] = key === 'block' ? 1100 : 0;
  }
}
state.walletStats.actionableInfo.revealable.num = 2;
state.walletStats.actionableInfo.registerable.num = 1;
state.walletStats.actionableInfo.redeemable.num = 1;
const store = {
  getState: () => state,
  subscribe: () => noop,
  dispatch: () => { throw new Error('Fixture dispatch blocked'); },
};

// Seed component state directly; never invoke preflight, signing, or submission.
class BasketReview extends AuctionBasket {
  constructor(props) {
    super(props);
    this.state = {
      ...this.state,
      submissionPhase: query.get('phase') || 'idle',
      submissionFailedStage: query.get('phase') === 'failed' ? (query.get('uncertain') === '0' ? 'signing' : 'broadcasting') : '',
      broadcastUncertain: query.get('phase') === 'failed' && query.get('uncertain') !== '0',
      retryAllowed: query.get('phase') === 'failed' && query.get('uncertain') === '0',
      step: 'review',
      accepted: true,
      reviewedScope: basketScope([{name: 'fixture', bid: 10000000, lockup: 15000000}]),
      transactionScope: query.get('phase') === 'reviewing'
        ? basketScope([{name: 'fixture', bid: 10000000, lockup: 15000000}], 21600) : null,
      rowMeta: {fixture: {state: 'BIDDING', hoursUntilReveal: 12}},
    };
  }
}
class RegistrationReview extends RegisterAll {
  constructor(props) {
    super(props);
    this.state = {...this.state, loaded: true, operation: {
      status: 'paused', running: false, retryLocked: true,
      failedName: 'fixture-second', failedStage: 'broadcasting', notAttempted: ['fixture-third'],
      entries: [
        {name: 'fixture-first', status: 'submitted', stage: 'submitted', txid: 'a'.repeat(64)},
        {name: 'fixture-second', status: 'unknown', stage: 'broadcasting', txid: 'b'.repeat(64)},
        {name: 'fixture-third', status: 'queued', stage: 'queued', txid: null},
      ],
    }};
    const phase = query.get('phase');
    if (phase === 'idle') this.state.operation = null;
    if (phase === 'complete') this.state.operation = {
      status: 'complete', settledComplete: true, confirmedComplete: true, eligibleCount: 0,
      entries: [{name: 'fixture-first', status: 'submitted', stage: 'submitted', txid: 'a'.repeat(64)}],
    };
  }
}
const fixtureListings = [
  {nameLock: {name: 'fixture'}, params: {mode: 'fixed', price: 1000000}, status: 'FINALIZE_CONFIRMED'},
  {nameLock: {name: 'fixture-long-domain-name'}, params: {mode: 'fixed', price: 2000000}, status: 'TRANSFER_CONFIRMED'},
  {nameLock: {name: 'fixture-sold'}, params: {mode: 'fixed', price: 3000000}, status: 'SOLD'},
];
class MarketReady extends ExchangeScreen {
  constructor(props) {
    super(props);
    this.state = {...this.state, isLoadingLocalListings: false};
  }
  isMarketplaceVisible() { return true; }
}
function PopulatedMarket() {
  return <MarketReady spv={false} nodeProgress={1} walletSync={false} walletHeight={1000}
    isCustomRPCConnected={false} network="regtest" height={1000} walletType="standard"
    walletWatchOnly={false} walletId="fixture-only" walletsDetails={{}} deeplinkParams={{}}
    clearDeeplinkParams={noop} auctions={[]} total={0} currentPage={1}
    marketplaceStatus="loaded" fulfillments={[]} listings={fixtureListings} />;
}
const common = {
  order: ['fixture'],
  items: {fixture: {bidAmount: '10', blindAmount: '5'}},
  spendableBalance: 100000000,
  network: 'regtest',
  names: {},
  watchingNames: [],
  currentStep: 1,
  totalSteps: 3,
  onBack: noop, onNext: noop, onCancel: noop, onClose: noop,
};
function LoginReview() {
  return <div className="app__uninitialized-wrapper">
    <AppHeader isMainMenu isRunning history={{push: noop}} changeNetwork={noop} />
    <div className="app__uninitialized app__uninitialized--auto-height"><Login /></div>
  </div>;
}
let RawSend = Send;
while (RawSend.WrappedComponent) RawSend = RawSend.WrappedComponent;
class ConfirmReview extends RawSend {
  constructor(props) {
    super(props);
    this.state = {...this.state, amount: '10.000001', to: 'FIXTURE-NOT-A-VALID-ADDRESS', feeAmount: 0.01, txSize: 250};
  }
  render() {return this.renderConfirm();}
}
function SendConfirmation() {
  return <ConfirmReview location={{search: ''}} fees={{standard: 200}} network="regtest" explorer={{}} />;
}
class AddonsReview extends Addons {
  constructor(props) {
    super(props);
    this.state = {...this.state, pendingExternalAddon: ADDONS.find(a => a.id === 'liquidity-spot'),
      liquiditySpotChannels: [{host: 'liquidity.spot', label: 'Liquidity'}]};
  }
}
function CatalogReview() {return <AddonsReview location={{pathname: '/addons'}} history={{push: noop}} deeplinkParams={{}} />;}
const screens = {
  selling: [() => <div className="my-domain"><Records name="fixture" network="regtest"
    domain={{isOwner: true, info: {registered: true}}} resource={{records: []}}
    currentHeight={1000} editable sellingOptions transferring={false} deeplinkParams={{}}
    showSuccess={noop} sendUpdate={noop} clearDeeplinkParams={noop} loadCanonicalNameInfo={noop}
    refreshCanonicalNameInfo={noop} openProposalFile={noop} readProposalFile={noop}
    history={{push: noop}} /></div>, '/domains/fixture'],
  login: [LoginReview, '/login'],
  confirm: [SendConfirmation, '/send'],
  addons: [CatalogReview, '/addons'],
  onboarding: [Onboard, '/funding-options'],
  warning: [ImportWarning, '/import-seed'],
  backup: [Backup, '/new-wallet'],
  password: [Password, '/new-wallet'],
  overview: [Overview, '/overview'],
  balance: [() => <div className="overview"><BalanceSummary locale={localeName} walletName="fixture-only"
    walletStats={{...state.walletStats, status: query.get('summary') || 'ready',
      isLoading: ['loading', 'slow'].includes(query.get('summary')),
      error: query.get('summary') === 'failed' ? 'timeout' : null,
      elapsedMs: ['slow', 'failed'].includes(query.get('summary')) ? 35000 : 0}}
    walletType="standard" balanceReady={true} progress={1}
    spendableBalance={123456789012345} lockedUnconfirmed={1000000000000}
    confirmedBalance={124456789012345} unconfirmedBalance={124456789012345} /></div>, '/overview'],
  send: [Send, '/send'],
  receive: [Receive, '/receive'],
  basket: [Basket, '/auction-basket'],
  review: [BasketReview, '/auction-basket'],
  registration: [() => <RegistrationReview eligibilityReady registerable={{num: 3, HNS: 1000000, verified: false}} />, '/bids'],
  open: [OpenBasket, '/open-basket'],
  domains: [Domains, '/domains'],
  marketplace: [Exchange, '/exchange'],
  'market-ready': [PopulatedMarket, '/exchange'],
  settings: [Settings, '/settings/general'],
  seed: [RevealSeed, '/settings/wallet'],
  finalize: [FinalizeWithPaymentModal, '/domains/fixture'],
};
const key = query.get('screen') || 'onboarding';
const [Screen, route] = screens[key] || screens.onboarding;
const t = (key, ...args) => translateLocale(localeName, null, key, ...args);
try {
  // SSR avoids componentDidMount/effects. No React hydration or event handlers.
  document.getElementById('root').innerHTML = renderToStaticMarkup(
    <Provider store={store}>
      <StaticRouter location={route} context={{}}>
        <I18nContext.Provider value={{t, locale: localeName}}>
          {shell && !['settings', 'login'].includes(key) ? (
            <div className="app">
              <aside className="app__sidebar-wrapper" style={{background: '#f0f2f5', paddingTop: 24}}>
                <strong>{t('headingExchange')}</strong><p>Fixture / 230px</p>
              </aside>
              <main className="app__main-wrapper"><section className="app__content">
                <Screen {...common} name="fixture" transferTo="FIXTURE-NOT-A-VALID-ADDRESS" />
              </section></main>
            </div>
          ) : <Screen {...common} name="fixture" transferTo="FIXTURE-NOT-A-VALID-ADDRESS" />}
        </I18nContext.Provider>
      </StaticRouter>
    </Provider>,
  );
  document.getElementById('root').inert = true;
  // Review-only positioning keeps wallet controls inert while exposing overflow.
  requestAnimationFrame(() => {
    const content = document.querySelector('.app__content') || document.querySelector('.settings__content');
    if (content) content.scrollTop = Number(query.get('offset')) || 0;
    if (query.get('edge') === 'right') {
      document.querySelectorAll('.exchange-table').forEach(table => {
        table.scrollLeft = table.scrollWidth;
      });
    }
  });
  document.getElementById('review-nav').innerHTML = Object.keys(screens)
    .map(screen => `<a href="?screen=${screen}&shell=${shell ? 1 : 0}&locale=${localeName}&theme=${dark ? 'dark' : 'light'}">${screen}</a>`).join(' | ');
} catch (error) {
  document.getElementById('root').textContent = error.stack;
}
