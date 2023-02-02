import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  AuctionPanel,
  AuctionPanelFooter,
  AuctionPanelHeader,
  AuctionPanelHeaderRow,
} from '../../../components/AuctionPanel';
import Blocktime from '../../../components/Blocktime';
import { displayBalance } from '../../../utils/balances';
import * as logger from '../../../utils/logClient';
import * as nameActions from '../../../ducks/names';
import { showError, showSuccess } from '../../../ducks/notifications';
import { clientStub as aClientStub } from '../../../background/analytics/client';
import {I18nContext} from "../../../utils/i18n";

const analytics = aClientStub(() => require('electron').ipcRenderer);

class Reveal extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    sendReveal: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    hasRevealableBid: PropTypes.bool.isRequired,
    hasPendingReveal: PropTypes.bool.isRequired,
    hasRevealed: PropTypes.bool.isRequired,
    totalBids: PropTypes.number.isRequired,
    totalMasks: PropTypes.number.isRequired,
  };

  static contextType = I18nContext;

  getTimeRemaining = () => {
    const {info} = this.props.domain || {};
    const {stats} = info || {};
    const {revealPeriodEnd, hoursUntilClose} = stats || {};

    if (!revealPeriodEnd) {
      return this.context.t('revealingNow');
    }

    if (hoursUntilClose < 24) {
      const hours = Math.floor(hoursUntilClose);
      const mins = Math.floor((hoursUntilClose - hours) * 60);
      return `~${hours}h ${mins}m`;
    }

    const days = Math.floor(hoursUntilClose / 24);
    const hours = Math.floor(hoursUntilClose - days*24);
    const mins = Math.floor((hoursUntilClose - days*24 - hours) * 60);
    return `~${days}d ${hours}h ${mins}m`;
  };

  sendReveal = async () => {
    const {sendReveal} = this.props;

    try {
      const res = await sendReveal();
      if (res !== null) {
        this.props.showSuccess(this.context.t('revealSuccess'));
        analytics.track('revealed bid');
      }
    } catch (e) {
      logger.error(`Error received from Reveal - sendReveal]\n\n${e.message}\n${e.stack}\n`);
      this.props.showError(this.context.t('revealFailure', e.message));
    }
  };

  render() {
    const {domain, hasRevealableBid} = this.props;
    const {bids = [], info} = domain || {};
    const highest = Math.max(...bids.map(bid => bid.value));
    const {t} = this.context;

    return (
      <AuctionPanel>
        <AuctionPanelHeader title={t('auctionDetailTitle')}>
          <AuctionPanelHeaderRow label={t('revealEnds') + ':'}>
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
            {bids.length ? displayBalance(highest, true) : t('noBids')}
          </AuctionPanelHeaderRow>
        </AuctionPanelHeader>
        <AuctionPanelFooter>
          {
            hasRevealableBid
              ? this.renderRevealable()
              : (
                <div className="domains__bid-now__action">
                  <button className="domains__bid-now__action__cta" disabled>
                    {t('noBidsToReveal')}
                  </button>
                </div>
              )
          }
        </AuctionPanelFooter>
      </AuctionPanel>
    );
  }

  renderRevealable() {
    const {
      totalBids,
      totalMasks,
    } = this.props;

    const {t} = this.context;

    return (
      <div className="domains__bid-now__action--placing-bid">
        <div className="domains__bid-now__title">{t('yourBids')}</div>
        <div className="domains__bid-now__content">
          <AuctionPanelHeaderRow label={t('totalBids') + ':'}>
            {totalBids < 0 ? '?' : displayBalance(totalBids, true)}
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label={t('totalLockups') + ':'}>
            {displayBalance(totalMasks, true)}
          </AuctionPanelHeaderRow>
          {this.renderWarning()}
          {this.renderAction()}
        </div>
      </div>
    );
  }

  renderAction() {
    const {
      hasRevealableBid,
      hasRevealed,
      hasPendingReveal,
      needsRepair,
    } = this.props;
    const {t} = this.context;

    let text = t('revealYourBids');
    let cname = 'domains__bid-now__action__cta'

    if (hasRevealed) {
      text = t('bidSuccessfullyRevealed');
    }

    if (hasPendingReveal) {
      text = t('revealPending');
    }

    if (needsRepair) {
      text = t('repairUnknownBids');
      cname = 'domains__bid-now__action__warning';
    }

    return (
      <div className="domains__bid-now__action">
        <button
          className={cname}
          onClick={this.sendReveal}
          disabled={hasRevealed || hasPendingReveal || !hasRevealableBid || needsRepair}
        >
          {text}
        </button>
      </div>
    );
  }

  renderWarning() {
    const {hasRevealableBid, totalMasks, hasRevealed} = this.props;
    if (hasRevealed || !hasRevealableBid) {
      return <div className="domains__bid-now__info__warning" />;
    }

    return (
      <div className="domains__bid-now__info__warning">
        {this.context.t('revealWarning', displayBalance(totalMasks, true))}
      </div>
    );
  }
}

export default connect(
  (state, {domain}) => ({
    hasRevealableBid: _hasRevealableBid(domain),
    hasPendingReveal: _hasPendingReveal(domain),
    hasRevealed: _hasRevealed(domain),
    needsRepair: getTotalBids(domain) < 0,
    totalBids: getTotalBids(domain),
    totalMasks: getTotalMasks(domain),
    network: state.wallet.network,
  }),
  (dispatch, {name}) => ({
    sendReveal: () => dispatch(nameActions.sendReveal(name)),
    showError: (message) => dispatch(showError(message)),
    showSuccess: (message) => dispatch(showSuccess(message)),
  }),
)(Reveal);

function _hasRevealableBid(domain) {
  for (const {bid, height} of domain.bids) {
    if (bid.own) {
      return height >= domain.info.height;
    }
  }

  return false;
}

function _hasPendingReveal(domain) {
  if (domain.pendingOperation === 'REVEAL') {
    return true;
  }

  return false;
}

function _hasRevealed(domain) {
  for (const reveal of domain.reveals) {
    if (reveal.bid.own) {
      return true;
    }
  }

  return false;
}

function getTotalBids(domain) {
  let total = 0;

  for (const {bid} of domain.bids) {
    if (bid.own) {
      // This is our bid, but we don't know its value
      if (typeof bid.value === 'undefined')
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
