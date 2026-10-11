import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import c from 'classnames';
import * as networks from 'hsd/lib/protocol/networks';
import { displayBalance } from '../../utils/balances';
import { hoursToNow } from '../../utils/timeConverter';
import { clientStub as aClientStub } from '../../background/analytics/client';
import * as walletActions from '../../ducks/walletActions';
import * as myDomainsActions from '../../ducks/myDomains';
import * as nodeActions from '../../ducks/node';
import { getExchangeListings } from '../../ducks/exchange';
import { LISTING_STATUS } from '../../constants/exchange';
import { BIDS_FILTER_NEED_REVEAL, NAME_STATES } from '../../constants/names';
import { MARKETPLACE_STATUS } from '../../utils/marketplaceRequest';
import { I18nContext } from '../../utils/i18n';
import {fetchWalletStats} from '../../ducks/walletStats';
import BalanceSummary from './BalanceSummary';
import AuctionSummaryStatus from './AuctionSummaryStatus';
import {balanceReadiness} from '../../utils/balanceReadiness';
import './overview.scss';

const analytics = aClientStub(() => require('electron').ipcRenderer);

// ~30 days of 10-minute blocks — matches Expiring page "soon" window.
const EXPIRING_SOON_BLOCKS = 30 * 24 * 6;

const ACTIVE_LISTING_STATUSES = new Set([
  LISTING_STATUS.ACTIVE,
  LISTING_STATUS.TRANSFER_CONFIRMING,
  LISTING_STATUS.TRANSFER_CONFIRMED,
  LISTING_STATUS.TRANSFER_CONFIRMED_LOCKUP,
  LISTING_STATUS.FINALIZE_CONFIRMING,
  LISTING_STATUS.FINALIZE_CONFIRMED,
  LISTING_STATUS.SALE_PENDING,
]);

@withRouter
@connect(
  (state) => ({
    locale: state.app.locale,
    spendableBalance: state.wallet.balance.spendable,
    confirmedBalance: state.wallet.balance.confirmed,
    unconfirmedBalance: state.wallet.balance.unconfirmed,
    lockedConfirmed: state.wallet.balance.lockedConfirmed,
    lockedUnconfirmed: state.wallet.balance.lockedUnconfirmed,
    balanceReady: state.wallet.balanceReady,
    height: state.node.chain.height,
    progress: state.node.chain.progress,
    chain: state.node.chain,
    network: state.wallet.network || state.node.network,
    hnsPrice: state.node.hnsPrice,
    showUsdValue: state.app.showUsdValue,
    walletId: state.wallet.wid,
    walletsDetails: state.wallet.walletsDetails,
    walletType: state.wallet.type,
    walletWatchOnly: state.wallet.watchOnly,
    wallets: state.wallet.wallets,
    spv: state.node.spv,
    walletSync: state.wallet.walletSync,
    walletHeight: state.wallet.walletHeight,
    rescanHeight: state.wallet.rescanHeight,
    newBlockStatus: state.node.newBlockStatus,
    updateAvailable: state.app.updateAvailable,
    names: state.myDomains.names,
    isFetchingNames: state.myDomains.isFetching,
    listings: state.exchange.listings,
    isLoadingListings: state.exchange.isLoadingListings,
    marketplaceStatus: state.exchange.marketplaceStatus,
    marketplaceError: state.exchange.marketplaceError,
    walletStats: state.walletStats,
  }),
  (dispatch) => ({
    fetchWallet: () => dispatch(walletActions.fetchWallet()),
    updateHNSPrice: () => dispatch(nodeActions.updateHNSPrice()),
    getMyNames: () => dispatch(myDomainsActions.getMyNames()),
    getExchangeListings: () => dispatch(getExchangeListings()),
    fetchWalletStats: () => dispatch(fetchWalletStats()),
  })
)
export default class Overview extends Component {
  static propTypes = {
    spendableBalance: PropTypes.number,
    confirmedBalance: PropTypes.number,
    unconfirmedBalance: PropTypes.number,
    lockedConfirmed: PropTypes.number,
    lockedUnconfirmed: PropTypes.number,
    balanceReady: PropTypes.bool,
    height: PropTypes.number,
    progress: PropTypes.number,
    chain: PropTypes.object,
    network: PropTypes.string,
    hnsPrice: PropTypes.object,
    showUsdValue: PropTypes.bool,
    walletId: PropTypes.string,
    walletsDetails: PropTypes.object,
    walletType: PropTypes.string,
    walletWatchOnly: PropTypes.bool,
    wallets: PropTypes.array,
    spv: PropTypes.bool,
    walletSync: PropTypes.bool,
    walletHeight: PropTypes.number,
    rescanHeight: PropTypes.number,
    newBlockStatus: PropTypes.string,
    updateAvailable: PropTypes.object,
    names: PropTypes.object.isRequired,
    isFetchingNames: PropTypes.bool,
    listings: PropTypes.array,
    isLoadingListings: PropTypes.bool,
    marketplaceStatus: PropTypes.string,
    marketplaceError: PropTypes.string,
    walletStats: PropTypes.object.isRequired,
    fetchWallet: PropTypes.func.isRequired,
    updateHNSPrice: PropTypes.func.isRequired,
    getMyNames: PropTypes.func.isRequired,
    getExchangeListings: PropTypes.func.isRequired,
    fetchWalletStats: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
  };

  static contextType = I18nContext;

  componentDidMount() {
    analytics.screenView('Overview');
    this.props.fetchWallet();
    this.props.getMyNames();
    this.props.getExchangeListings();
    this.updateStats();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.height !== prevProps.height
      || this.props.walletHeight !== prevProps.walletHeight
      || this.props.walletId !== prevProps.walletId
      || this.props.network !== prevProps.network
      || this.props.balanceReady !== prevProps.balanceReady
      || this.props.walletSync !== prevProps.walletSync
    ) {
      this.updateStats();
    }
  }

  async updateStats() {
    this.props.updateHNSPrice();

    try {
      await this.props.fetchWalletStats();
    } catch (error) {
      console.warn('Auction summary unavailable; see correlated auction-summary diagnostics.');
    }
  }

  go = (path) => {
    this.props.history.push(path);
  };

  getWalletDisplayName() {
    const { walletId, walletsDetails } = this.props;
    return walletsDetails?.[walletId]?.displayName || walletId || '—';
  }

  getOwnedNameCount() {
    return Object.keys(this.props.names || {}).length;
  }

  getExpiringSoonCount() {
    const { names, height, network } = this.props;
    if (!names || !height || !network || !networks[network]) {
      return 0;
    }

    const renewalWindow = networks[network].names.renewalWindow;
    let count = 0;

    Object.values(names).forEach((domain) => {
      if (!domain || domain.renewal == null) return;
      const expireHeight = domain.renewal + renewalWindow;
      const blocksLeft = expireHeight - height;
      if (blocksLeft > 0 && blocksLeft <= EXPIRING_SOON_BLOCKS) {
        count += 1;
      }
    });

    return count;
  }

  getActiveListingCount() {
    const listings = this.props.listings || [];
    return listings.filter((listing) => ACTIVE_LISTING_STATUSES.has(listing.status)).length;
  }

  getActionItems() {
    const { t } = this.context;
    const { network } = this.props;
    const {
      revealable,
      redeemable,
      renewable,
      transferring,
      finalizable,
      registerable,
    } = this.props.walletStats.actionableInfo;

    const items = [];

    if (revealable?.num) {
      items.push({
        key: 'reveal',
        level: 'urgent',
        title: t('overviewActionReveal', String(revealable.num)),
        detail: revealable.block != null
          ? t('overviewActionRevealDetail', blocksDeltaToTimeDelta(revealable.block, network, t))
          : t('overviewActionOpenBids'),
        path: `/bids/${BIDS_FILTER_NEED_REVEAL}`,
      });
    }

    if (registerable?.num) {
      items.push({
        key: 'register',
        level: 'attention',
        title: t('overviewActionRegister', String(registerable.num)),
        detail: t('overviewActionOpenBids'),
        path: `/bids/${NAME_STATES.CLOSED}`,
      });
    }

    if (redeemable?.num) {
      items.push({
        key: 'redeem',
        level: 'attention',
        title: t('overviewActionRedeem', String(redeemable.num)),
        detail: t(
          'overviewActionRedeemDetail',
          String(Math.round((redeemable.HNS || 0) / 1e6))
        ),
        path: `/bids/${NAME_STATES.CLOSED}`,
      });
    }

    if (renewable?.domains?.length) {
      items.push({
        key: 'renew',
        level: 'urgent',
        title: t('overviewActionRenew', String(renewable.domains.length)),
        detail: renewable.block != null
          ? t('overviewActionRenewDetail', blocksDeltaToTimeDelta(renewable.block, network, t))
          : t('overviewActionOpenDomains'),
        path: '/domain_manager',
      });
    }

    if (finalizable?.domains?.length) {
      items.push({
        key: 'finalize',
        level: 'attention',
        title: t('overviewActionFinalize', String(finalizable.domains.length)),
        detail: t('overviewActionOpenDomains'),
        path: '/domain_manager',
      });
    }

    if (transferring?.domains?.length) {
      items.push({
        key: 'transfer',
        level: 'info',
        title: t('overviewActionTransfer', String(transferring.domains.length)),
        detail: transferring.block != null
          ? t('overviewActionTransferDetail', blocksDeltaToTimeDelta(transferring.block, network, t))
          : t('overviewActionOpenDomains'),
        path: '/domain_manager',
      });
    }

    const expiringSoon = this.getExpiringSoonCount();
    if (expiringSoon > 0 && !renewable?.domains?.length) {
      items.push({
        key: 'expiring',
        level: 'info',
        title: t('overviewActionExpiring', String(expiringSoon)),
        detail: t('overviewActionOpenExpiring'),
        path: '/expiring',
      });
    }

    return items;
  }

  getSyncLabel() {
    const { t } = this.context;
    const {
      progress,
      walletSync,
      walletHeight,
      rescanHeight,
      height,
      newBlockStatus,
    } = this.props;

    if (newBlockStatus) {
      return newBlockStatus;
    }

    if (walletSync && rescanHeight) {
      const pct = Math.floor((walletHeight * 100) / rescanHeight);
      return t('overviewHealthWalletRescanning', String(pct));
    }

    if (progress != null && progress < 0.9999) {
      return t('overviewHealthChainSyncing', ((progress || 0) * 100).toFixed(1));
    }

    if (height) {
      return t('overviewHealthSynchronized');
    }

    return t('overviewHealthUnknown');
  }

  getMarketplaceLabel() {
    const { t } = this.context;
    const { isLoadingListings, marketplaceError, marketplaceStatus } = this.props;

    if (isLoadingListings || marketplaceStatus === MARKETPLACE_STATUS.LOADING) {
      return t('overviewHealthMarketplaceLoading');
    }
    if (
      marketplaceError
      || marketplaceStatus === MARKETPLACE_STATUS.ERROR
      || marketplaceStatus === MARKETPLACE_STATUS.TIMEOUT
    ) {
      return t('overviewHealthMarketplaceError');
    }
    if (
      marketplaceStatus === MARKETPLACE_STATUS.LOADED
      || marketplaceStatus === MARKETPLACE_STATUS.IDLE
      || !marketplaceStatus
    ) {
      return t('overviewHealthMarketplaceReady');
    }
    return marketplaceStatus || t('overviewHealthUnknown');
  }

  render() {
    const { t } = this.context;
    const { isLoading: isLoadingStats } = this.props.walletStats;
    const actionItems = this.getActionItems();

    return (
      <div className="overview">
        {this.renderHero()}
        {this.renderActionCenter(actionItems)}
        {this.renderPortfolioAndAuctions()}
        {this.renderSystemHealth()}

        {isLoadingStats && (
          <div className="overview__loading">{t('overviewLoading')}</div>
        )}
      </div>
    );
  }

  renderHero() {
    return <BalanceSummary {...this.props} walletName={this.getWalletDisplayName()} onRetryStats={() => this.updateStats()} />;
  }

  renderActionCenter(items) {
    const { t } = this.context;
    if (this.props.walletStats.isLoading || this.props.walletStats.error
      || balanceReadiness(this.props) !== 'ready') {
      return <section className="overview__section">
        <h3>{t('overviewActionCenter')}</h3>
        <AuctionSummaryStatus stats={this.props.walletStats} onRetry={() => this.updateStats()} waiting={balanceReadiness(this.props) !== 'ready'} />
      </section>;
    }
    const count = items.length;

    return (
      <section className="overview__section">
        <div className="overview__section-header">
          <h3>{t('overviewActionCenter')}</h3>
          <span className={c('overview__badge', {
            'overview__badge--alert': count > 0,
            'overview__badge--ok': count === 0,
          })}>
            {count > 0
              ? t('overviewActionBadge', String(count))
              : t('overviewActionBadgeClear')}
          </span>
        </div>

        {count === 0 ? (
          <div className="overview__empty">
            <span className="overview__empty-icon" />
            {this.props.walletStats.isLoading
              ? t('overviewLoading')
              : t('overviewNoActions')}
          </div>
        ) : (
          <div className="overview__actions">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                className={c('overview__action', `overview__action--${item.level}`)}
                onClick={() => this.go(item.path)}
              >
                <span className="overview__action-dot" aria-hidden="true" />
                <span className="overview__action-body">
                  <span className="overview__action-title">{item.title}</span>
                  <span className="overview__action-detail">{item.detail}</span>
                </span>
                <span className="overview__action-go">{t('overviewOpen')} →</span>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  renderPortfolioAndAuctions() {
    const { t } = this.context;
    const { isFetchingNames, isLoadingListings } = this.props;
    const { lockedBalance, actionableInfo } = this.props.walletStats;
    const statsReady = !this.props.walletStats.isLoading && !this.props.walletStats.error
      && this.props.walletStats.status === 'ready' && balanceReadiness(this.props) === 'ready';
    const counter = value => statsReady ? String(value) : '—';

    const ownedCount = this.getOwnedNameCount();
    const expiringSoon = this.getExpiringSoonCount();
    const listingCount = this.getActiveListingCount();
    const biddingNum = lockedBalance?.bidding?.num || 0;
    const revealNum = actionableInfo?.revealable?.num || 0;
    const redeemNum = actionableInfo?.redeemable?.num || 0;
    const registerNum = actionableInfo?.registerable?.num || 0;
    const transferNum = actionableInfo?.transferring?.domains?.length || 0;
    const inRevealLock = lockedBalance?.revealable?.num || 0;

    return (
      <section className="overview__section">
        <div className="overview__section-header">
          <h3>{t('overviewPortfolioAndAuctions')}</h3>
          <p>{t('overviewPortfolioHelp')}</p>
        </div>

        <div className="overview__grid overview__grid--counts">
          <StatCard
            label={t('overviewOwnedNames')}
            value={isFetchingNames && !ownedCount ? '…' : String(ownedCount)}
            onClick={() => this.go('/domain_manager')}
          />
          <StatCard
            label={t('overviewExpiringSoon')}
            value={String(expiringSoon)}
            subtext={t('overviewExpiringSoonHelp')}
            tone={expiringSoon > 0 ? 'warn' : null}
            onClick={() => this.go('/expiring')}
          />
          <StatCard
            label={t('overviewActiveListings')}
            value={isLoadingListings && !listingCount ? '…' : String(listingCount)}
            onClick={() => this.go('/exchange')}
          />
          <StatCard
            label={t('overviewTransferring')}
            value={counter(transferNum)}
            onClick={() => this.go('/domain_manager')}
          />
          <StatCard
            label={t('overviewBidding')}
            value={counter(biddingNum)}
            onClick={() => this.go('/bids')}
          />
          <StatCard
            label={t('overviewInReveal')}
            value={counter(inRevealLock)}
            onClick={() => this.go('/bids')}
          />
          <StatCard
            label={t('overviewNeedReveal')}
            value={counter(revealNum)}
            tone={revealNum > 0 ? 'alert' : null}
            onClick={() => this.go(`/bids/${BIDS_FILTER_NEED_REVEAL}`)}
          />
          <StatCard
            label={t('overviewNeedRedeem')}
            value={counter(redeemNum)}
            tone={redeemNum > 0 ? 'warn' : null}
            onClick={() => this.go(`/bids/${NAME_STATES.CLOSED}`)}
          />
          <StatCard
            label={t('overviewNeedRegister')}
            value={counter(registerNum)}
            tone={registerNum > 0 ? 'warn' : null}
            onClick={() => this.go(`/bids/${NAME_STATES.CLOSED}`)}
          />
        </div>
      </section>
    );
  }

  renderSystemHealth() {
    const { t } = this.context;
    const {
      spv,
      height,
      walletHeight,
      updateAvailable,
    } = this.props;

    const modeLabel = spv ? t('overviewHealthSpv') : t('overviewHealthFullNode');
    const syncLabel = this.getSyncLabel();
    const marketplaceLabel = this.getMarketplaceLabel();
    const updateLabel = updateAvailable
      ? t('overviewHealthUpdateAvailable')
      : t('overviewHealthUpToDate');

    return (
      <section className="overview__section">
        <div className="overview__section-header">
          <h3>{t('overviewSystemHealth')}</h3>
          <p>{t('overviewSystemHealthHelp')}</p>
        </div>

        <div className="overview__grid overview__grid--health">
          <StatCard
            compact
            label={t('overviewHealthMode')}
            value={modeLabel}
            onClick={() => this.go('/settings')}
          />
          <StatCard
            compact
            label={t('overviewHealthSync')}
            value={syncLabel}
            subtext={
              height
                ? t('overviewHealthHeights', String(height), String(walletHeight || height))
                : null
            }
            onClick={() => this.go('/settings')}
          />
          <StatCard
            compact
            label={t('overviewHealthMarketplace')}
            value={marketplaceLabel}
            onClick={() => this.go('/exchange')}
          />
          <StatCard
            compact
            label={t('overviewHealthUpdates')}
            value={updateLabel}
            tone={updateAvailable ? 'warn' : null}
            onClick={() => this.go('/settings')}
          />
        </div>
      </section>
    );
  }
}

function StatCard({ label, value, subtext, onClick, compact, tone }) {
  return (
    <button
      type="button"
      className={c('overview__card', {
        'overview__card--compact': compact,
        'overview__card--clickable': !!onClick,
        'overview__card--alert': tone === 'alert',
        'overview__card--warn': tone === 'warn',
      })}
      onClick={onClick}
    >
      <span className="overview__card-label">{label}</span>
      <span className="overview__card-value">{value}</span>
      {subtext ? <span className="overview__card-subtext">{subtext}</span> : null}
    </button>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  subtext: PropTypes.node,
  onClick: PropTypes.func,
  compact: PropTypes.bool,
  tone: PropTypes.oneOf(['alert', 'warn']),
};

function pluralize(value, word, ending = 's') {
  if (value == 1) {
    return word;
  }
  return word + ending;
}

function blocksDeltaToTimeDelta(blocks, network, t) {
  if (blocks == null || !network || !networks[network]) {
    return t('durationUnavailable');
  }
  const hours = (blocks * networks[network].pow.targetSpacing) / 3600;
  return hoursToNow(hours, t);
}
