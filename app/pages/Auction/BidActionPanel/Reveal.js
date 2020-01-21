import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  AuctionPanel,
  AuctionPanelFooter,
  AuctionPanelHeader,
  AuctionPanelHeaderRow,
} from '../../../components/AuctionPanel';
import { returnBlockTime } from '../../../components/Blocktime';
import AddToCalendar from 'react-add-to-calendar';
import moment from 'moment';
import { displayBalance } from '../../../utils/balances';
import * as logger from '../../../utils/logClient';
import * as nameActions from '../../../ducks/names';
import { showError, showSuccess } from '../../../ducks/notifications';
import { clientStub as aClientStub } from '../../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

const CAL_ITEMS = [
  {google: 'Google'},
  {apple: 'iCal'},
  {outlook: 'Outlook'},
];

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

  state = {
    event: {},
    revealEndDate: null,
  };

  async componentDidMount() {
    const {domain, network} = this.props;
    const {info} = domain || {};
    const {stats} = info || {};
    const {revealPeriodEnd} = stats || {};
    const revealEndDate = await returnBlockTime(revealPeriodEnd, network);
    const event = await this.generateEvent();

    this.setState({event, revealEndDate});
  }

  async generateEvent() {
    const {domain, network, name} = this.props;
    const {info} = domain || {};
    const {stats} = info || {};
    const {revealPeriodEnd} = stats || {};

    const startDatetime = await returnBlockTime(revealPeriodEnd, network);

    const endDatetime = startDatetime.clone().add(1, 'hours');

    const event = {
      title: `Reveal End of ${name}`,
      description: `The Handshake domain ${name} will to revealable until block ${revealPeriodEnd}. Make sure to reveal your bids before the reveal period ends.`,
      location: 'The Decentralized Internet',
      startTime: startDatetime.format(),
      endTime: endDatetime.format(),
    };

    return event;
  }

  getTimeRemaining = () => {
    const {info} = this.props.domain || {};
    const {stats} = info || {};
    const {revealPeriodEnd} = stats || {};

    if (!revealPeriodEnd) {
      return 'Revealing now!';
    }

    if (revealPeriodEnd < 24) {
      const hours = Math.floor(revealPeriodEnd % 24);
      const mins = Math.floor((revealPeriodEnd % 1) * 60);
      return `~${hours}h ${mins}m`;
    }

    const days = Math.floor(revealPeriodEnd / 24);
    const hours = Math.floor(revealPeriodEnd % 24);
    const mins = Math.floor((revealPeriodEnd % 1) * 60);
    return `~${days}d ${hours}h ${mins}m`;
  };

  sendReveal = async () => {
    const {sendReveal} = this.props;

    try {
      await sendReveal();
      this.props.showSuccess('Successfully revealed bid!');
      analytics.track('revealed bid');
    } catch (e) {
      console.error(e);
      logger.error(`Error received from Reveal - sendReveal]\n\n${e.message}\n${e.stack}\n`);
      this.props.showError('Failed to reveal bid. Please try again.');
    }
  };

  render() {
    const {domain, hasRevealableBid} = this.props;
    const {bids = [], info} = domain || {};
    const {highest = 0} = info || {};

    return (
      <AuctionPanel>
        <AuctionPanelHeader title="Auction Details">
          <AuctionPanelHeaderRow label="Reveal Ends:">
            <div className="domains__bid-now__info__time-remaining">
              <div>
                <AddToCalendar
                  event={this.state.event}
                  listItems={CAL_ITEMS}
                />
                {this.getTimeRemaining()}
              </div>
            </div>
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label="Total Bids:">
            {bids.length}
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label="Highest Mask:">
            {highest}
          </AuctionPanelHeaderRow>
        </AuctionPanelHeader>
        <AuctionPanelFooter>
          {
            hasRevealableBid
              ? this.renderRevealable()
              : (
                <div className="domains__bid-now__action">
                  <button className="domains__bid-now__action__cta" disabled>
                    No Bids to Reveal
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

    return (
      <div className="domains__bid-now__action--placing-bid">
        <div className="domains__bid-now__title">Your Bids</div>
        <div className="domains__bid-now__content">
          <AuctionPanelHeaderRow label="Total Bids:">
            {displayBalance(totalBids, true)}
          </AuctionPanelHeaderRow>
          <AuctionPanelHeaderRow label="Total Masks:">
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
    } = this.props;

    let text = 'Reveal Your Bids';

    if (hasRevealed) {
      text = 'Bid Successfully Revealed';
    }

    if (hasPendingReveal) {
      text = 'Reveal Pending...';
    }

    return (
      <div className="domains__bid-now__action">
        <button
          className="domains__bid-now__action__cta"
          onClick={this.sendReveal}
          disabled={hasRevealed || hasPendingReveal || !hasRevealableBid}
        >
          {text}
        </button>
      </div>
    );
  }

  renderWarning() {
    const {hasRevealableBid, totalMasks, hasRevealed} = this.props;
    const {revealEndDate} = this.state;

    if (hasRevealed || !hasRevealableBid) {
      return <div className="domains__bid-now__info__warning" />;
    }

    return (
      <div className="domains__bid-now__info__warning">
        {`You will lose ${displayBalance(totalMasks, true)} if you don't reveal before ${moment(revealEndDate).format('MM/DD/YYYY')}.`}
      </div>
    );
  }
}

export default connect(
  (state, {domain}) => ({
    hasRevealableBid: _hasRevealableBid(domain),
    hasPendingReveal: _hasPendingReveal(domain),
    hasRevealed: _hasRevealed(domain),
    totalBids: getTotalBids(domain),
    totalMasks: getTotalMasks(domain),
    network: state.node.network,
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
