import React, { Component, Fragment } from "react";
import PropTypes from "prop-types";
import c from "classnames";
import { withRouter } from "react-router";
import { connect } from "react-redux";
import Transactions from "../../components/Transactions";
import PhraseMismatch from "../../components/PhraseMismatch";
import ShakedexDeprecated from '../../components/ShakedexDeprecated';
import "./account.scss";
import walletClient from "../../utils/walletClient";
import { displayBalance } from "../../utils/balances";
import { hoursToNow } from "../../utils/timeConverter";
import * as networks from "hsd/lib/protocol/networks";
import { clientStub as aClientStub } from "../../background/analytics/client";
import * as walletActions from "../../ducks/walletActions";
import { showError, showSuccess } from "../../ducks/notifications";
import * as nameActions from "../../ducks/names";
import * as nodeActions from "../../ducks/node";
import { fetchTransactions } from "../../ducks/walletActions";
import throttle from "lodash.throttle";
import {I18nContext} from "../../utils/i18n";

const analytics = aClientStub(() => require("electron").ipcRenderer);

@withRouter
@connect(
  (state) => ({
    spendableBalance: state.wallet.balance.spendable,
    height: state.node.chain.height,
    progress: state.node.chain.progress,
    isFetching: state.wallet.isFetching,
    network: state.wallet.network,
    hnsPrice: state.node.hnsPrice,
    walletInitialized: state.wallet.initialized,
    walletType: state.wallet.type,
  }),
  (dispatch) => ({
    fetchWallet: () => dispatch(walletActions.fetchWallet()),
    updateHNSPrice: () => dispatch(nodeActions.updateHNSPrice()),
    sendRevealAll: () => dispatch(nameActions.sendRevealAll()),
    sendRedeemAll: () => dispatch(nameActions.sendRedeemAll()),
    sendRegisterAll: () => dispatch(nameActions.sendRegisterAll()),
    finalizeAll: () => dispatch(nameActions.finalizeAll()),
    renewAll: () => dispatch(nameActions.renewAll()),
    showSuccess: (message) => dispatch(showSuccess(message)),
    showError: (message) => dispatch(showError(message)),
    fetchTransactions: () => dispatch(fetchTransactions()),
  })
)
export default class Account extends Component {
  _isMounted = false;

  static propTypes = {
    spendableBalance: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    progress: PropTypes.number.isRequired,
    isFetching: PropTypes.bool.isRequired,
    network: PropTypes.string.isRequired,
    updateHNSPrice: PropTypes.func.isRequired,
    fetchWallet: PropTypes.func.isRequired,
    sendRevealAll: PropTypes.func.isRequired,
    sendRedeemAll: PropTypes.func.isRequired,
    sendRegisterAll: PropTypes.func.isRequired,
    finalizeAll: PropTypes.func.isRequired,
    renewAll: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
    walletInitialized: PropTypes.bool.isRequired,
    walletType: PropTypes.string.isRequired,
  };

  static contextType = I18nContext;

  state = {
    isLoadingStats: true,
    lockedBalance: {
      bidding: { HNS: null, num: null },
      revealable: { HNS: null, num: null },
      finished: { HNS: null, num: null },
    },
    actionableInfo: {
      revealable: { HNS: null, num: null, block: null },
      redeemable: { HNS: null, num: null },
      renewable: { domains: null, block: null },
      transferring: { domains: null, block: null },
      finalizable: { domains: null, block: null },
      registerable: { HNS: null, num: null },
    },
  };

  constructor(props) {
    super(props);
    this.updateStatsAndBalance = throttle(this.updateStatsAndBalance, 15000, { trailing: true });

    const {walletType, walletInitialized} = this.props;

    if (walletType === 'multisig' && !walletInitialized) {
      this.props.history.push('/multisig');
    }
  }

  componentDidMount() {
    this._isMounted = true;
    analytics.screenView("Account");
    this.props.fetchWallet();
    this.updateStatsAndBalance();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.height !== prevProps.height) {
      this.updateStatsAndBalance();
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  /**
   * Refresh $HNS price,
   * calculate balance and cards
   * (Unthrottled update, call without _ to throttle)
   */
  async _updateStatsAndBalance() {
    // Update HNS price for conversion
    this.props.updateHNSPrice();

    // Stats for balance and cards
    try {
      const stats = await walletClient.getStats();
      if (this._isMounted) {
        this.setState({
          isLoadingStats: false,
          ...stats,
        });
      }
    } catch (error) {
      console.error(error);
      this.setState({ isLoadingStats: false });
    }
  }

  updateStatsAndBalance = throttle(this._updateStatsAndBalance, 15000, { trailing: true })

  onCardButtonClick = async (action, args) => {
    const {t} = this.context;

    const functionToExecute = {
      reveal: this.props.sendRevealAll,
      redeem: this.props.sendRedeemAll,
      register: this.props.sendRegisterAll,
      finalize: this.props.finalizeAll,
      renew: this.props.renewAll,
    }[action];

    try {
      const res = await functionToExecute(args);
      if (res !== null) {
        this.props.fetchTransactions();
        this._updateStatsAndBalance();
        this.props.showSuccess(t('genericRequestSuccess'));
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
    const { lockedBalance, isLoadingStats } = this.state;
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

    return (
      <div className="account__header">
        {/* Spendable Balance */}
        <div className="account__header__section">
          <span className="label">{t('spendable')}</span>
          <p className="amount">
            {displayBalance(spendableBalance.HNS || 0, true, 2)}
          </p>
          <span className="subtext">
            ~${spendableBalance.converted || "0.00"} {spendableBalance.currency}
          </span>
        </div>

        {/* Locked Balance - In bids */}
        {lockedBalance.bidding.HNS > 0 ? (
          <div className="account__header__section">
            <span className="label">{t('locked')}</span>
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
            <span className="label">{t('locked')}</span>
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
            <span className="label">{t('locked')}</span>
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
            <span className="label">{t('locked')}</span>
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
      registerable,
    } = this.state.actionableInfo;

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

        {/* Registerable Card */}
        {registerable.num ? (
          <ActionCard
            color="yellow"
            text={
              <Fragment>
                <strong>{t('register')}</strong> {registerable.num}{" "}
                {t('domains')}
              </Fragment>
            }
            subtext={
              <Fragment>
                {t('registerCardWarning', Math.round(registerable.HNS / 1e6))}
              </Fragment>
            }
            buttonAction={() => this.onCardButtonClick("register")}
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
            buttonAction={() => this.onCardButtonClick("finalize")}
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
        onClick={buttonAction || undefined}
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
