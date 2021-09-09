import React, { Component, Fragment } from "react";
import PropTypes from "prop-types";
import c from "classnames";
import { withRouter } from "react-router";
import { connect } from "react-redux";
import Transactions from "../../components/Transactions";
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

const analytics = aClientStub(() => require("electron").ipcRenderer);

@withRouter
@connect(
  (state) => ({
    spendableBalance: state.wallet.balance.spendable,
    height: state.node.chain.height,
    isFetching: state.wallet.isFetching,
    network: state.wallet.network,
    hnsPrice: state.node.hnsPrice,
  }),
  (dispatch) => ({
    fetchWallet: () => dispatch(walletActions.fetchWallet()),
    updateHNSPrice: () => dispatch(nodeActions.updateHNSPrice()),
    sendRevealAll: () => dispatch(nameActions.sendRevealAll()),
    sendRedeemAll: () => dispatch(nameActions.sendRedeemAll()),
    sendRegisterAll: () => dispatch(nameActions.sendRegisterAll()),
    finalizeMany: (names) => dispatch(nameActions.finalizeMany(names)),
    renewMany: (names) => dispatch(nameActions.renewMany(names)),
    showSuccess: (message) => dispatch(showSuccess(message)),
    showError: (message) => dispatch(showError(message)),
    fetchTransactions: () => dispatch(fetchTransactions()),
  })
)
export default class Account extends Component {
  static propTypes = {
    spendableBalance: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    isFetching: PropTypes.bool.isRequired,
    network: PropTypes.string.isRequired,
    updateHNSPrice: PropTypes.func.isRequired,
    fetchWallet: PropTypes.func.isRequired,
    sendRevealAll: PropTypes.func.isRequired,
    sendRedeemAll: PropTypes.func.isRequired,
    sendRegisterAll: PropTypes.func.isRequired,
    finalizeMany: PropTypes.func.isRequired,
    renewMany: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
  };

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
  }

  componentDidMount() {
    analytics.screenView("Account");
    this.props.fetchWallet();
    this.updateStatsAndBalance();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.height !== prevProps.height) {
      this.updateStatsAndBalance();
    }
  }

  async updateStatsAndBalance() {
    // Update HNS price for conversion
    this.props.updateHNSPrice();

    // Stats for balance and cards
    try {
      const stats = await walletClient.getStats();
      this.setState({
        isLoadingStats: false,
        ...stats,
      });
    } catch (error) {
      console.error(error);
      this.setState({ isLoadingStats: false });
    }
  }

  onCardButtonClick = async (action, args) => {
    const functionToExecute = {
      reveal: this.props.sendRevealAll,
      redeem: this.props.sendRedeemAll,
      register: this.props.sendRegisterAll,
      finalize: this.props.finalizeMany,
      renew: this.props.renewMany,
    }[action];

    try {
      await functionToExecute(args);
      this.props.fetchTransactions();
      this.props.showSuccess(
        "Your request is submitted! Please wait about 15 minutes for it to complete."
      );
    } catch (e) {
      this.props.showError(e.message);
    }
  };

  render() {
    const { isFetching } = this.props;

    return (
      <div className="account">
        {this.maybeRenderTXAlert()}
        {this.renderBalance()}
        {this.renderCards()}

        {/* Transactions */}
        <div className="account__transactions">
          <div className="account__panel-title">
            Transaction History
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
          <span className="label">SPENDABLE</span>
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
            <span className="label">LOCKED</span>
            <p className="amount">
              {displayBalance(lockedBalance.bidding.HNS, true, 2)}
            </p>
            <span className="subtext">
              In bids ({lockedBalance.bidding.num}{" "}
              {pluralize(lockedBalance.bidding.num, "bid")})
            </span>
          </div>
        ) : (
          ""
        )}

        {showFirstPlus ? <div className="plus">+</div> : ""}

        {/* Locked Balance - In Reveal */}
        {lockedBalance.revealable.HNS > 0 ? (
          <div className="account__header__section">
            <span className="label">LOCKED</span>
            <p className="amount">
              {displayBalance(lockedBalance.revealable.HNS, true, 2)}
            </p>
            <span className="subtext">
              In reveal ({lockedBalance.revealable.num}{" "}
              {pluralize(lockedBalance.revealable.num, "bid")})
            </span>
          </div>
        ) : (
          ""
        )}

        {showSecondPlus ? <div className="plus">+</div> : ""}

        {/* Locked Balance - Finished */}
        {lockedBalance.finished.HNS > 0 ? (
          <div className="account__header__section">
            <span className="label">LOCKED</span>
            <p className="amount">
              {displayBalance(lockedBalance.finished.HNS, true, 2)}
            </p>
            <span className="subtext">
              In finished auctions ({lockedBalance.finished.num}{" "}
              {pluralize(lockedBalance.finished.num, "bid")})
            </span>
          </div>
        ) : (
          ""
        )}

        {/* No Locked HNS (or still loading) */}
        {noLockedHNS ? (
          <div className="account__header__section">
            <span className="label">LOCKED</span>
            <p
              className={c("amount", {
                account__transactions__loading: isLoadingStats,
              })}
            >
              {isLoadingStats ? "Loading balance..." : displayBalance(0, true)}
            </p>
            <span className="subtext">
              {isLoadingStats ? "" : "No locked HNS"}
            </span>
          </div>
        ) : (
          ""
        )}
      </div>
    );
  }

  renderCards() {
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
                <strong>Reveal</strong> {revealable.num}{" "}
                {pluralize(revealable.num, "bid")}
              </Fragment>
            }
            subtext={
              <Fragment>
                within{" "}
                <strong>
                  {blocksDeltaToTimeDelta(revealable.block, network, true)}
                </strong>{" "}
                for the bids to count
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
                <strong>Renew</strong> {renewable.domains.length}{" "}
                {pluralize(renewable.domains.length, "domain")}
              </Fragment>
            }
            subtext={
              <Fragment>
                in{" "}
                <strong>
                  {blocksDeltaToTimeDelta(renewable.block, network, true)}
                </strong>{" "}
                or lose the {pluralize(renewable.domains.length, "domain")}
              </Fragment>
            }
            buttonAction={() =>
              this.onCardButtonClick("renew", renewable.domains)
            }
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
                <strong>Redeem</strong> {redeemable.num}{" "}
                {pluralize(redeemable.num, "bid")}
              </Fragment>
            }
            subtext={
              <Fragment>
                from lost auctions to get back{" "}
                <strong>{Math.round(redeemable.HNS / 1e6)} HNS</strong>
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
                <strong>Register</strong> {registerable.num}{" "}
                {pluralize(registerable.num, "domain")}
              </Fragment>
            }
            subtext={
              <Fragment>
                that you’ve won and get back{" "}
                <strong>{Math.round(registerable.HNS / 1e6)} HNS</strong>
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
                <strong>Finalize</strong> {finalizable.domains.length}{" "}
                {pluralize(finalizable.domains.length, "domain")}
              </Fragment>
            }
            subtext={
              <Fragment>
                to complete your{" "}
                {pluralize(finalizable.domains.length, "transfer")}
              </Fragment>
            }
            buttonAction={() =>
              this.onCardButtonClick("finalize", finalizable.domains)
            }
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
                <strong>Transferring</strong> {transferring.domains.length}{" "}
                {pluralize(transferring.domains.length, "domain")}
              </Fragment>
            }
            subtext={
              <Fragment>
                ready to finalize in{" "}
                <strong>
                  {blocksDeltaToTimeDelta(transferring.block, network)}
                </strong>
              </Fragment>
            }
          />
        ) : (
          ""
        )}
      </div>
    );
  }

  maybeRenderTXAlert() {
    if (this.props.height > 2016) {
      return null;
    }

    return (
      <div className="account__alert">
        <strong>Important:</strong> Transactions are disabled for the first two
        weeks of mainnet.
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
  if (hideMinsIfLarge === true && hours > 48) {
    return `${(hours / 24) >>> 0} days`;
  }
  return hoursToNow(hours);
}
