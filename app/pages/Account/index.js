import React, { Component, Fragment } from "react";
import PropTypes from "prop-types";
import c from "classnames";
import { withRouter } from "react-router";
import { connect } from "react-redux";
import Transactions from "../../components/Transactions";
import "./account.scss";
import { displayBalance } from "../../utils/balances";
import { hoursToNow } from "../../utils/timeConverter";
import * as networks from "hsd/lib/protocol/networks";
import { clientStub as aClientStub } from "../../background/analytics/client";
import * as walletActions from "../../ducks/walletActions";
import { showError, showSuccess } from "../../ducks/notifications";
import * as nameActions from "../../ducks/names";
import { updateBalanceAndCardsData } from "./functions";

const analytics = aClientStub(() => require("electron").ipcRenderer);

@withRouter
@connect(
  (state) => ({
    spendableBalance: state.wallet.balance.spendable,
    height: state.node.chain.height,
    isFetching: state.wallet.isFetching,
    network: state.node.network,
  }),
  (dispatch) => ({
    fetchWallet: () => dispatch(walletActions.fetchWallet()),
    sendRevealAll: () => dispatch(nameActions.sendRevealAll()),
    sendRedeemAll: () => dispatch(nameActions.sendRedeemAll()),
    sendRegisterAll: () => dispatch(nameActions.sendRegisterAll()),
    finalizeMany: (names) => dispatch(nameActions.finalizeMany(names)),
  })
)
export default class Account extends Component {
  static propTypes = {
    spendableBalance: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    isFetching: PropTypes.bool.isRequired,
    network: PropTypes.string.isRequired,
    fetchWallet: PropTypes.func.isRequired,
    sendRevealAll: PropTypes.func.isRequired,
    sendRedeemAll: PropTypes.func.isRequired,
    sendRegisterAll: PropTypes.func.isRequired,
    history: PropTypes.object.isRequired,
  };

  state = {
    isLoadingStats: true,
    spendableBalance: {
      HNS: this.props.spendableBalance,
      USD: null,
    },
    lockedBalance: {
      bidding: { HNS: null, num: null },
      revealing: { HNS: null, num: null },
      finished: { HNS: null, num: null },
    },
    actionableInfoBids: {
      revealable: { HNS: null, num: null, block: null },
      redeemable: { HNS: null, num: null },
      registerable: { HNS: null, num: null },
    },
    actionableInfoNames: {
      renewable: { domains: null, block: null },
      transferring: { domains: null, block: null },
      finalizable: { domains: null, block: null },
    },
  };

  componentDidMount() {
    analytics.screenView("Account");
    this.props.fetchWallet();
    updateBalanceAndCardsData(this.props.spendableBalance, (payload) =>
      this.setState(payload)
    );
  }

  componentWillUpdate(newProps, newState) {
    // TODO: DELETE BEFORE MERGE
    console.log(newState);
  }

  onCardButtonClick = async (action, args) => {
    const functionToExecute = {
      reveal: this.props.sendRevealAll,
      redeem: this.props.sendRedeemAll,
      register: this.props.sendRegisterAll,
      finalize: this.props.finalizeMany,
    }[action];

    try {
      await functionToExecute(args);
      showSuccess(
        "Your request is submitted! Please wait about 15 minutes for it to complete."
      );
    } catch (e) {
      showError(e.message);
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
    const { spendableBalance, lockedBalance, isLoadingStats } = this.state;

    const showFirstPlus =
      lockedBalance.bidding.num && lockedBalance.revealing.num;
    const showSecondPlus =
      (lockedBalance.bidding.num && lockedBalance.finished.num) ||
      (lockedBalance.revealing.num && lockedBalance.finished.num);
    const noLockedHNS = !(
      lockedBalance.finished.num ||
      lockedBalance.finished.num ||
      lockedBalance.finished.num
    );

    return (
      <div className="account__header">
        {/* Spendable Balance */}
        <div className="account__header__section">
          <span className="label">SPENDABLE</span>
          <p className="amount">
            {displayBalance(spendableBalance.HNS ?? 0, true)}
          </p>
          <span className="subtext">
            ~${displayBalance(spendableBalance.USD ?? 0, false)} USD
          </span>
        </div>

        {/* Locked Balance - In Live Auctions */}
        {lockedBalance.bidding.num > 0 ? (
          <div className="account__header__section">
            <span className="label">LOCKED</span>
            <p className="amount">
              {displayBalance(lockedBalance.bidding.HNS, true)}
            </p>
            <span className="subtext">
              In live auctions ({lockedBalance.bidding.num}{" "}
              {pluralize(lockedBalance.bidding.num, "bid")})
            </span>
          </div>
        ) : (
          ""
        )}

        {showFirstPlus ? <div className="plus">+</div> : ""}

        {/* Locked Balance - In Reveal */}
        {lockedBalance.revealing.num > 0 ? (
          <div className="account__header__section">
            <span className="label">LOCKED</span>
            <p className="amount">
              {displayBalance(lockedBalance.revealing.HNS, true)}
            </p>
            <span className="subtext">
              In reveal ({lockedBalance.revealing.num}{" "}
              {pluralize(lockedBalance.revealing.num, "bid")})
            </span>
          </div>
        ) : (
          ""
        )}

        {showSecondPlus ? <div className="plus">+</div> : ""}

        {/* Locked Balance - Finished */}
        {lockedBalance.finished.num > 0 ? (
          <div className="account__header__section">
            <span className="label">LOCKED</span>
            <p className="amount">
              {displayBalance(lockedBalance.finished.HNS, true)}
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
    const history = this.props.history;
    const { revealable, redeemable, registerable } =
      this.state.actionableInfoBids;
    const { renewable, transferring, finalizable } =
      this.state.actionableInfoNames;

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
            buttonText="REVEAL ALL"
            buttonAction={() => this.onCardButtonClick("reveal")}
          />
        ) : (
          ""
        )}

        {/* Renewable Card */}
        {renewable?.domains?.size ? (
          <ActionCard
            color="red"
            text={
              <Fragment>
                <strong>Renew</strong> {renewable.domains.size}{" "}
                {pluralize(renewable.domains.size, "domain")}
              </Fragment>
            }
            subtext={
              <Fragment>
                in{" "}
                <strong>
                  {blocksDeltaToTimeDelta(renewable.block, network, true)}
                </strong>{" "}
                or lose the {pluralize(renewable.domains.size, "domain")}
              </Fragment>
            }
            buttonText="RENEW ALL"
            buttonAction={() => history.push("/bids")}
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
                <strong>{redeemable.HNS / 1e6} HNS</strong>
              </Fragment>
            }
            buttonText="REDEEM ALL"
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
                <strong>{registerable.HNS / 1e6} HNS</strong>
              </Fragment>
            }
            buttonText="REGISTER ALL"
            buttonAction={() => this.onCardButtonClick("register")}
          />
        ) : (
          ""
        )}

        {/* Finalizable Card */}
        {finalizable?.domains?.size ? (
          <ActionCard
            color="green"
            text={
              <Fragment>
                <strong>Finalize</strong> {finalizable.domains.size}{" "}
                {pluralize(finalizable.domains.size, "domain")}
              </Fragment>
            }
            subtext={
              <Fragment>
                to complete your{" "}
                {pluralize(finalizable.domains.size, "transfer")}
              </Fragment>
            }
            buttonText="FINALIZE ALL"
            buttonAction={() =>
              this.onCardButtonClick("finalize", [...finalizable.domains])
            }
          />
        ) : (
          ""
        )}

        {/* Transferring Card */}
        {transferring?.domains?.size ? (
          <ActionCard
            color="green"
            text={
              <Fragment>
                <strong>Transferring</strong> {transferring.domains.size}{" "}
                {pluralize(transferring.domains.size, "domain")}
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
            buttonText="PENDING TRANSFER"
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
    buttonText: PropTypes.string.isRequired,
    buttonAction: PropTypes.func,
  };

  render() {
    const { color, text, subtext, buttonText, buttonAction } = this.props;

    return (
      <div className={c("cards__card", `cards__card--${color}`)}>
        <button disabled={!buttonAction} onClick={buttonAction || undefined}>
          {buttonText}
        </button>
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
