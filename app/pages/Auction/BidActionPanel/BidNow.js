import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {consensus} from 'hsd/lib/protocol';
import Network from 'hsd/lib/protocol/network'
import {
  AuctionPanel,
  AuctionPanelFooter,
  AuctionPanelHeader,
  AuctionPanelHeaderRow,
} from '../../../components/AuctionPanel';
import Tooltipable from '../../../components/Tooltipable';
import SuccessModal from '../../../components/SuccessModal';
import Checkbox from '../../../components/Checkbox';
import * as nameActions from '../../../ducks/names';
import { showError, showSuccess } from '../../../ducks/notifications';
import {displayBalance, toBaseUnits} from '../../../utils/balances';
import * as logger from '../../../utils/logClient';
import walletClient from '../../../utils/walletClient';
import * as walletActions from '../../../ducks/walletActions';
import { clientStub as aClientStub } from '../../../background/analytics/client';
import {I18nContext} from "../../../utils/i18n";

const analytics = aClientStub(() => require('electron').ipcRenderer);

class BidNow extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    totalBids: PropTypes.number.isRequired,
    totalMasks: PropTypes.number.isRequired,
    ownHighestBid: PropTypes.object,
    isPending: PropTypes.bool.isRequired,
    spendableBalance: PropTypes.number.isRequired,
    getNameInfo: PropTypes.func.isRequired,
    waitForWalletSync: PropTypes.func.isRequired,
    startWalletSync: PropTypes.func.isRequired,
    stopWalletSync: PropTypes.func.isRequired,
    network: PropTypes.string.isRequired,
  };

  static contextType = I18nContext;

  state = {
    isPlacingBid: false,
    shouldAddDisguise: false,
    isReviewing: false,
    hasAccepted: false,
    bidAmount: '',
    disguiseAmount: '',
    successfullyBid: false,
    showSuccessModal: false,
  };

  getTimeRemaining = () => {
    const {info} = this.props.domain || {};
    const {stats} = info || {};
    const {hoursUntilReveal} = stats || {};

    const network = Network.get(this.props.network || 'main');
    const timeLeftToBid = hoursUntilReveal - (network.pow.targetSpacing / 60 / 60) // seconds to hours

    if (timeLeftToBid < 24) {
      const hours = Math.floor(timeLeftToBid % 24);
      const mins = Math.floor((timeLeftToBid % 1) * 60);
      return `~${hours}h ${mins}m`;
    }

    const days = Math.floor(timeLeftToBid / 24);
    const hours = Math.floor(timeLeftToBid % 24);
    const mins = Math.floor((timeLeftToBid % 1) * 60);
    return `~${days}d ${hours}h ${mins}m`;
  };

  sendBid = async () => {
    const {sendBid, domain} = this.props;
    const {bidAmount, disguiseAmount} = this.state;
    const lockup = Number(disguiseAmount) + Number(bidAmount);

    try {
      let height = null;
      if (!domain.walletHasName)
        height = domain.info.height - 1;

      await sendBid(bidAmount, lockup, height);
      this.setState({
        isReviewing: false,
        isPlacingBid: false,
        successfullyBid: true,
        showSuccessModal: true,
      });
      analytics.track('sent bid');
    } catch (e) {
      console.error(e);
      await this.props.stopWalletSync();
      logger.error(`Error received from BidNow - sendBid]\n\n${e.message}\n${e.stack}\n`);
      this.props.showError(`Failed to place bid: ${e.message}`);
    } finally {
      await this.props.fetchPendingTransactions();
      await this.props.getNameInfo(domain.name);
    }
  };

  rescanAuction = async () => {
    try {
      const {domain} = this.props;
      await this.props.startWalletSync();
      await walletClient.importName(domain.name, domain.info.height - 1);
      await this.props.getNameInfo(domain.name);
    } catch (e) {
      await this.props.stopWalletSync();
      this.props.showError(e.message);
    }
  };

  processValue = (val, field) => {
    const value = val.match(/[0-9]*\.?[0-9]{0,6}/g)[0];
    if (Number.isNaN(parseFloat(value)))
      return;
    if (value * consensus.COIN > consensus.MAX_MONEY)
      return;
    this.setState({[field]: value});
  };

  render() {
    const {domain} = this.props;

    const {
      bidAmount,
      disguiseAmount,
      showSuccessModal,
      isPlacingBid,
    } = this.state;

    const {bids = [], info} = domain || {};
    const {highest = 0, stats} = info || {};
    const {bidPeriodEnd} = stats || {};
    const {t} = this.context;

    return (
      <AuctionPanel>
        {
          showSuccessModal && (
            <SuccessModal
              bidAmount={bidAmount}
              maskAmount={Number(bidAmount) + Number(disguiseAmount)}
              revealStartBlock={bidPeriodEnd}
              onClose={() => this.setState({
                showSuccessModal: false,
                hasAccepted: false,
                bidAmount: '',
                disguiseAmount: '',
              })}
            />
          )
        }
        <AuctionPanelHeader title={t('auctionDetailTitle')}>
          <AuctionPanelHeaderRow label={t('biddingEnds') + ':'}>
            <div className="domains__bid-now__info__time-remaining">
              <div>
                {this.getTimeRemaining()}
              </div>
            </div>
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label={t('totalBids') + ':'}>
            {bids.length}
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label={t('highestLockup') + ':'}>
            {highest}
          </AuctionPanelHeaderRow>
          <div className="domains__bid-now__info__disclaimer">
            <Tooltipable
              tooltipContent={t('bidNowDisclaimer')}>
              <div className="domains__bid-now__info__icon" />
            </Tooltipable>
            {t('winnerPays')}
          </div>
        </AuctionPanelHeader>
        {isPlacingBid ? this.renderBidNow() : this.renderOwnBidAction()}
        {domain.walletHasName ? '' : this.renderRescanButton()}
      </AuctionPanel>
    );
  }

  renderBiddingView() {
    const {
      bidAmount,
      disguiseAmount
    } = this.state;

    const {spendableBalance} = this.props;

    const {t} = this.context;

    return (
      <AuctionPanelFooter>
        <div className="domains__bid-now__action domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__form">
            <div className="domains__bid-now__form__row">
              <div className="domains__bid-now__form__row__label">{t('bidAmount')}:</div>
              <div className="domains__bid-now__form__row__input">
                <input
                  placeholder="0.00"
                  onChange={e => this.processValue(e.target.value, 'bidAmount')}
                  value={bidAmount}
                />
              </div>
            </div>
            {this.renderMask()}
          </div>
          <button
            className="domains__bid-now__action__cta"
            onClick={() => this.setState({isReviewing: true})}
            // bid amount of zero is allowed as long as a disguise is used
            disabled={bidAmount > 0 ? false : (disguiseAmount > 0 ? false : true)}
          >
            {t('reviewBid')}
          </button>
        </div>
        <div className="domains__bid-now__action domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__HNS-status">
            {t('availableHNSText', displayBalance(spendableBalance))}
          </div>
        </div>
      </AuctionPanelFooter>
    );
  }

  renderMask() {
    const {
      shouldAddDisguise,
      disguiseAmount,
    } = this.state;

    const {t} = this.context;

    if (shouldAddDisguise) {
      return (
        <div className="domains__bid-now__form__row">
          <div className="domains__bid-now__form__row__label">
            <Tooltipable
              className="domains__bid-now__mask"
              tooltipContent={(
                <span className="domains__bid-now__mask-tooltip">
                  {t('blindTooltip')}
                </span>
              )}
            >
              {t('blindAmount') + ':'}
            </Tooltipable>
          </div>
          <div className="domains__bid-now__form__row__input">
            <input
              placeholder={t('optional')}
              onChange={e => this.processValue(e.target.value, 'disguiseAmount')}
              value={disguiseAmount}
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className="domains__bid-now__form__link"
        onClick={() => this.setState({shouldAddDisguise: true})}
      >
        {t('addABlind')}
      </div>
    );
  }

  renderOwnHighestBid() {
    const {ownHighestBid, totalBids, totalMasks} = this.props;
    const {t} = this.context;

    if (ownHighestBid) {
      return (
        <div className="domains__bid-now__own-highest-bid">
          <div className="domains__bid-now__own-highest-bid__title">{t('yourHighestBid')}</div>
          <div className="domains__bid-now__content">
            <AuctionPanelHeaderRow label={t('totalBids') + ':'}>
              {totalBids < 0 ? '?' : displayBalance(totalBids, true)}
            </AuctionPanelHeaderRow>
            <AuctionPanelHeaderRow label={t('totalLockups') + ':'}>
              {displayBalance(totalMasks, true)}
            </AuctionPanelHeaderRow>
          </div>
        </div>
      );
    }
  }

  renderOwnBidAction() {
    const {t} = this.context;
    const {pendingOperation} = this.props.domain;
    const pendingBidExists = pendingOperation === 'BID';

    return (
      <AuctionPanelFooter>
        {this.renderOwnHighestBid()}
        <div className="domains__bid-now__action">
          <button
            className="domains__bid-now__action__cta"
            onClick={() => this.setState({isPlacingBid: true})}
          >
            {pendingBidExists ? t('placeAnotherBid') : t('placeBid')}
          </button>
        </div>
      </AuctionPanelFooter>
    );
  }

  renderReviewing() {
    const {
      bidAmount,
      disguiseAmount,
      hasAccepted,
    } = this.state;

    const {t} = this.context;

    return (
      <AuctionPanelFooter>
        <div className="domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__title">{t('reviewYourBid')}</div>
          <div className="domains__bid-now__content">
            <AuctionPanelHeaderRow label={t('bidAmount') + ':'}>
              <div className="domains__bid-now__review-info">
                <div className="domains__bid-now__info__value">
                  {`${bidAmount} HNS`}
                </div>
                <div
                  className="domains__bid-now__action__edit-icon"
                  onClick={() => this.setState({isReviewing: false})}
                />
              </div>
            </AuctionPanelHeaderRow>
            <AuctionPanelHeaderRow label={t('blindAmount') + ':'}>
              <div className="domains__bid-now__review-info">
                <div className="domains__bid-now__info__value">
                  {disguiseAmount ? `${disguiseAmount} HNS` : ' - '}
                </div>
                <div
                  className="domains__bid-now__action__edit-icon"
                  onClick={() => this.setState({
                    isReviewing: false,
                    shouldAddDisguise: true,
                  })}
                />
              </div>
            </AuctionPanelHeaderRow>
            <div className="domains__bid-now__divider" />
            <AuctionPanelHeaderRow
              label={t('totalLockups') + ':'}
              className="domains__bid-now__review-total"
            >
              <div className="domains__bid-now__info__value">
                {`${Number(disguiseAmount) + Number(bidAmount)} HNS`}
              </div>
            </AuctionPanelHeaderRow>
          </div>
          <div className="domains__bid-now__action">
            <div className="domains__bid-now__action__agreement">
              <Checkbox
                onChange={e => this.setState({hasAccepted: e.target.checked})}
                checked={hasAccepted}
              />
              <div className="domains__bid-now__action__agreement-text">
                {t('bidAgreementText')}
              </div>
            </div>
            <button
              className="domains__bid-now__action__cta"
              onClick={this.sendBid}
              disabled={!hasAccepted}
            >
              {t('submitBid')}
            </button>
          </div>
        </div>
      </AuctionPanelFooter>
    );
  }

  renderBidNow() {
    const {isReviewing} = this.state;
    return isReviewing ? this.renderReviewing() : this.renderBiddingView();
  }

  renderRescanButton() {
    const {t} = this.context;
    return (
      <div className="domains__bid-now__action">
        <button
          className="domains__bid-now__action__cta"
          onClick={this.rescanAuction}
        >
          {t('rescanAuction')}
          <Tooltipable
            left={"-130px"}
            className="domains__bid-now__rescan-tooltip"
            tooltipContent={t('rescanTooltip')}>
            <div className="account__info-icon" />
          </Tooltipable>
        </button>
      </div>
    );
  }
}

export default connect(
  (state, {domain}) => ({
    spendableBalance: state.wallet.balance.spendable,
    ownHighestBid: _ownHighestBid(domain),
    totalBids: getTotalBids(domain),
    totalMasks: getTotalMasks(domain),
    network: state.wallet.network,
    isPending: domain.pendingOperation === 'BID',
  }),
  (dispatch, {name}) => ({
    sendBid: (amount, lockup, height) => dispatch(nameActions.sendBid(name, toBaseUnits(amount), toBaseUnits(lockup), height)),
    showError: (message) => dispatch(showError(message)),
    showSuccess: (message) => dispatch(showSuccess(message)),
    fetchPendingTransactions: () => dispatch(walletActions.fetchPendingTransactions()),
    waitForWalletSync: () => dispatch(walletActions.waitForWalletSync()),
    startWalletSync: () => dispatch(walletActions.startWalletSync()),
    stopWalletSync: () => dispatch(walletActions.stopWalletSync()),
    getNameInfo: tld => dispatch(nameActions.getNameInfo(tld)),
  }),
)(BidNow);

function getTotalBids(domain) {
  let total = 0;

  for (const {bid} of domain.bids) {
    if (bid.own) {
      // This is our bid, but we don't know its value
      if (bid.value == null)
        return -1;

      total += bid.value;
    }
  }

  return total;
}

function getTotalMasks(domain) {
  let total = 0;

  for (const {bid} of domain.bids) {
    if (bid.own) {
      total += bid.lockup;
    }
  }

  return total;
}

function _ownHighestBid(domain) {
  let highestBid = null;

  for (const {bid} of domain.bids) {
    if (bid.own) {
      if (!highestBid) {
        highestBid = bid;
      } else {
        highestBid = bid.value > highestBid.value ? bid : highestBid;
      }
    }
  }

  return highestBid;
}
