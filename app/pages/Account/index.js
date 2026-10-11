import React, { Component, Fragment } from "react";
import PropTypes from "prop-types";
import c from "classnames";
import { withRouter } from "react-router";
import { connect } from "react-redux";
import Transactions from "../../components/Transactions";
import PhraseMismatch from "../../components/PhraseMismatch";
import ShakedexDeprecated from '../../components/ShakedexDeprecated';
import RegisterAll from '../../components/RegisterAll';
import "./account.scss";
import { displayBalance } from "../../utils/balances";
import { hoursToNow } from "../../utils/timeConverter";
import * as networks from "hsd/lib/protocol/networks";
import { clientStub as aClientStub } from "../../background/analytics/client";
import * as walletActions from "../../ducks/walletActions";
import { showError, showSuccess } from "../../ducks/notifications";
import * as nameActions from "../../ducks/names";
import * as nodeActions from "../../ducks/node";
import { fetchTransactions } from "../../ducks/walletActions";
import {I18nContext} from "../../utils/i18n";
import {fetchWalletStats} from '../../ducks/walletStats';
import AuctionSummaryStatus from '../Overview/AuctionSummaryStatus';

const analytics = aClientStub(() => require("electron").ipcRenderer);

@withRouter
@connect(
  (state) => ({
    spendableBalance: state.wallet.balance.spendable,
    height: state.node.chain.height,
    walletHeight: state.wallet.walletHeight,
    progress: state.node.chain.progress,
    isFetching: state.wallet.isFetching,
    network: state.wallet.network,
    hnsPrice: state.node.hnsPrice,
    showUsdValue: state.app.showUsdValue,
    walletInitialized: state.wallet.initialized,
    walletType: state.wallet.type,
    walletStats: state.walletStats,
    walletId: state.wallet.wid,
    balanceReady: state.wallet.balanceReady,
    walletSync: state.wallet.walletSync,
  }),
  (dispatch) => ({
    fetchWallet: () => dispatch(walletActions.fetchWallet()),
    updateHNSPrice: () => dispatch(nodeActions.updateHNSPrice()),
    sendRevealAll: () => dispatch(nameActions.sendRevealAll()),
    sendRedeemAll: () => dispatch(nameActions.sendRedeemAll()),
    finalizeAll: () => dispatch(nameActions.finalizeAll()),
    finalizeMany: (names) => dispatch(nameActions.finalizeMany(names)),
    renewAll: () => dispatch(nameActions.renewAll()),
    showSuccess: (message) => dispatch(showSuccess(message)),
    showError: (message) => dispatch(showError(message)),
    fetchTransactions: () => dispatch(fetchTransactions()),
    fetchWalletStats: () => dispatch(fetchWalletStats()),
  })
)
export default class Account extends Component {
  static propTypes = {
    spendableBalance: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    walletHeight: PropTypes.number.isRequired,
    progress: PropTypes.number.isRequired,
    isFetching: PropTypes.bool.isRequired,
    network: PropTypes.string.isRequired,
    updateHNSPrice: PropTypes.func.isRequired,
    fetchWallet: PropTypes.func.isRequired,
    sendRevealAll: PropTypes.func.isRequired,
    sendRedeemAll: PropTypes.func.isRequired,
    finalizeAll: PropTypes.func.isRequired,
    finalizeMany: PropTypes.func.isRequired,
    renewAll: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    walletInitialized: PropTypes.bool.isRequired,
    walletType: PropTypes.string.isRequired,
    showUsdValue: PropTypes.bool.isRequired,
    walletStats: PropTypes.object.isRequired,
    fetchWalletStats: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);

    const {walletType, walletInitialized} = this.props;

    if (walletType === 'multisig' && !walletInitialized) {
      this.props.history.push('/multisig');
    }
  }

  componentDidMount() {
    analytics.screenView("Account");
    this.props.fetchWallet();
    this.updateStatsAndBalance();
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.props.height !== prevProps.height
      || this.props.walletHeight !== prevProps.walletHeight
      || this.props.walletId !== prevProps.walletId
      || this.props.network !== prevProps.network
      || this.props.balanceReady !== prevProps.balanceReady
      || this.props.walletSync !== prevProps.walletSync
    ) {
      this.updateStatsAndBalance();
    }
  }

  /**
   * Refresh $HNS price,
   * calculate balance and cards
   */
  async updateStatsAndBalance() {
    // Update HNS price for conversion
    this.props.updateHNSPrice();

    // Stats for balance and cards
    try {
      await this.props.fetchWalletStats();
    } catch (error) {
      console.warn('Auction summary unavailable; see correlated auction-summary diagnostics.');
    }
  }

  onCardButtonClick = async (action, args) => {
    const {t} = this.context;

    const functionToExecute = {
      reveal: this.props.sendRevealAll,
      redeem: this.props.sendRedeemAll,
      finalize: this.props.finalizeMany,
      renew: this.props.renewAll,
    }[action];

    try {
      const res = await functionToExecute(args);
      if (res !== null) {
        this.props.fetchTransactions();
        this.updateStatsAndBalance();
        if (action === 'finalize' && res && (res.hash || res.txid)) {
          const txid = res.hash || res.txid;
          const names = Array.isArray(args) && args.length
            ? ` for ${args.join(', ')}`
            : '';
          this.props.showSuccess(
            `Finalize transaction submitted${names}. Tx: ${txid}. It will show as finalized after it confirms on-chain.`
          );
        } else {
          this.props.showSuccess(t('genericRequestSuccess'));
        }
      }
    } catch (e) {
      if (e.message === 'Could not resolve preferred inputs.') {
        this.props.showError(t('pleaseWaitForPendingTxs'));
      } else {
        this.props.showError(e.message);
      }
    }
  };

  render() {
    const {t} = this.context;
    const { isFetching } = this.props;

    return (
      <div className="account">
        <PhraseMismatch />
        <ShakedexDeprecated />

        {this.renderBalance()}
        {this.renderCards()}
        <RegisterAll />

        {/* Transactions */}
        <div className="account__transactions">
          <div className="account__panel-title">
            {t('transactionHistory')}
            {isFetching && (
              <div className="account__transactions__loading">
                Loading transactions...
              </div>
            )}
          </div>
          <Transactions />
        </div>
      </div>
    );
  }

  renderBalance() {
    const {
      lockedBalance,
      isLoading: isLoadingStats,
    } = this.props.walletStats;
    const {t} = this.context;
    const spendableBalance = {
      HNS: this.props.spendableBalance,
      converted: (
        (this.props.spendableBalance * this.props.hnsPrice.value) /
        1e6
      ).toFixed(2),
      currency: this.props.hnsPrice.currency,
    };

    const showFirstPlus =
      lockedBalance.bidding.HNS && lockedBalance.revealable.HNS;
    const showSecondPlus =
      (lockedBalance.bidding.HNS && lockedBalance.finished.HNS) ||
      (lockedBalance.revealable.HNS && lockedBalance.finished.HNS);
    const noLockedHNS = !(
      lockedBalance.bidding.HNS ||
      lockedBalance.revealable.HNS ||
      lockedBalance.finished.HNS
    );
    const summaryUnavailable = isLoadingStats || this.props.walletStats.error
      || this.props.balanceReady === false || this.props.walletSync;

    return (
      <div className="account__header">
        {/* Spendable Balance */}
        <div className="account__header__section">
          <span className="label">{t('spendable')}</span>
          <p className="amount">
            {displayBalance(spendableBalance.HNS || 0, true, 2)}
          </p>
          {this.props.showUsdValue && (
            <span className="subtext">
              ~${spendableBalance.converted || "0.00"} {spendableBalance.currency}
            </span>
          )}
        </div>

        {/* Locked Balance - In bids */}
        {summaryUnavailable ? <div className="account__header__section">
          <span className="label">{t('overviewLockedAuctions')}</span>
          <AuctionSummaryStatus stats={this.props.walletStats} onRetry={() => this.updateStatsAndBalance()}
            waiting={this.props.balanceReady === false || this.props.walletSync} />
        </div> : <>
        {lockedBalance.bidding.HNS > 0 ? (
          <div className="account__header__section">
            <span className="label">{t('overviewLockedAuctions')}</span>
            <p className="amount">
              {displayBalance(lockedBalance.bidding.HNS, true, 2)}
            </p>
            <span className="subtext">
              {`${t('inBids')} (${lockedBalance.bidding.num}`}
              {" "}
              {pluralize(lockedBalance.bidding.num, t('bid'))})
            </span>
          </div>
        ) : (
          ""
        )}

        {showFirstPlus ? <div className="plus">+</div> : ""}

        {/* Locked Balance - In Reveal */}
        {lockedBalance.revealable.HNS > 0 ? (
          <div className="account__header__section">
            <span className="label">{t('overviewLockedAuctions')}</span>
            <p className="amount">
              {displayBalance(lockedBalance.revealable.HNS, true, 2)}
            </p>
            <span className="subtext">
              {`${t('inReveals')} (${lockedBalance.revealable.num}`}
              {" "}
              {pluralize(lockedBalance.revealable.num, t('bid'))})
            </span>
          </div>
        ) : (
          ""
        )}

        {showSecondPlus ? <div className="plus">+</div> : ""}

        {/* Locked Balance - Finished */}
        {lockedBalance.finished.HNS > 0 ? (
          <div className="account__header__section">
            <span className="label">{t('overviewLockedAuctions')}</span>
            <p className="amount">
              {displayBalance(lockedBalance.finished.HNS, true, 2)}
            </p>
            <span className="subtext">
              {`${t('inFinishedAuctions')} (${lockedBalance.finished.num}`}
              {" "}
              {pluralize(lockedBalance.finished.num, t('bid'))})
            </span>
          </div>
        ) : (
          ""
        )}

        {/* No Locked HNS (or still loading) */}
        {noLockedHNS ? (
          <div className="account__header__section">
            <span className="label">{t('overviewLockedAuctions')}</span>
            <p
              className={c("amount", {
                account__transactions__loading: isLoadingStats,
              })}
            >
              {isLoadingStats ? t('loadingBalance') : displayBalance(0, true)}
            </p>
            <span className="subtext">
              {isLoadingStats ? "" : t('noLockedHNS')}
            </span>
          </div>
        ) : (
          ""
        )}
        </>}
      </div>
    );
  }

  renderCards() {
    const {t} = this.context;
    // Hide cards until (almost) synced
    if (this.props.progress < 0.9999) {
      return;
    }

    const network = this.props.network;
    const {
      revealable,
      redeemable,
      renewable,
      transferring,
      finalizable,
    } = this.props.walletStats.actionableInfo;

    return (
      <div className="cards__container">
        {/* Revealable Card */}
        {revealable.num ? (
          <ActionCard
            color="red"
            text={
              <Fragment>
                <strong>{t('reveal')}</strong> {revealable.num}{" "}
                {pluralize(revealable.num, t('bid'))}
              </Fragment>
            }
            subtext={
              <Fragment>
                {t('revealCardWarning', blocksDeltaToTimeDelta(revealable.block, network, true))}
              </Fragment>
            }
            buttonAction={() => this.onCardButtonClick("reveal")}
          />
        ) : (
          ""
        )}

        {/* Renewable Card */}
        {renewable?.domains?.length ? (
          <ActionCard
            color="red"
            text={
              <Fragment>
                <strong>{t('renew')}</strong> {renewable.domains.length}{" "}
                {t('domains')}
              </Fragment>
            }
            subtext={
              <Fragment>
                {t('renewCardWarning', blocksDeltaToTimeDelta(renewable.block, network, true))}
              </Fragment>
            }
            buttonAction={() => this.onCardButtonClick("renew")}
          />
        ) : (
          ""
        )}

        {/* Redeemable Card */}
        {redeemable.num ? (
          <ActionCard
            color="yellow"
            text={
              <Fragment>
                <strong>{t('redeem')}</strong> {redeemable.num}{" "}
                {t('bids')}
              </Fragment>
            }
            subtext={
              <Fragment>
                {t('redeemCardWarning', Math.round(redeemable.HNS / 1e6))}
              </Fragment>
            }
            buttonAction={() => this.onCardButtonClick("redeem")}
          />
        ) : (
          ""
        )}

        {/* Finalizable Card */}
        {finalizable?.domains?.length ? (
          <ActionCard
            color="green"
            text={
              <Fragment>
                <strong>{t('finalize')}</strong> {finalizable.domains.length}{" "}
                {t('domains')}
              </Fragment>
            }
            subtext={
              <Fragment>
                {t('transferCardWarning')}
              </Fragment>
            }
            buttonAction={() => this.onCardButtonClick("finalize", finalizable.domains)}
          />
        ) : (
          ""
        )}

        {/* Transferring Card */}
        {transferring?.domains?.length ? (
          <ActionCard
            color="green"
            text={
              <Fragment>
                <strong>{t('transferring')}</strong> {transferring.domains.length}{" "}
                {t('domains')}
              </Fragment>
            }
            subtext={
              <Fragment>
                {t('finalizeCardWarning', blocksDeltaToTimeDelta(transferring.block, network))}
              </Fragment>
            }
          />
        ) : (
          ""
        )}
      </div>
    );
  }
}

class ActionCard extends Component {
  static propTypes = {
    color: PropTypes.string.isRequired,
    text: PropTypes.object.isRequired,
    subtext: PropTypes.object.isRequired,
    buttonAction: PropTypes.func,
  };

  render() {
    const { color, text, subtext, buttonAction } = this.props;

    return (
      <div
        className={c("cards__card", `cards__card--${color}`)}
        onClick={buttonAction ? buttonAction : undefined}
      >
        <p className="title">{text}</p>
        <p className="subtitle">{subtext}</p>
      </div>
    );
  }
}

function pluralize(value, word, ending = "s") {
  if (value == 1) {
    return word;
  }
  return word + ending;
}

function blocksDeltaToTimeDelta(blocks, network, hideMinsIfLarge = false) {
  const hours = (blocks * networks[network].pow.targetSpacing) / 3600;
  // if (hideMinsIfLarge === true && hours > 48) {
  //   return `${(hours / 24) >>> 0} days`;
  // }
  return hoursToNow(hours);
}
