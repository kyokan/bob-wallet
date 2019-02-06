import React, {Component} from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  AuctionPanel,
  AuctionPanelHeader,
  AuctionPanelFooter,
  AuctionPanelHeaderRow
} from '../../../components/AuctionPanel';
import Tooltipable from '../../../components/Tooltipable';
import SuccessModal from '../../../components/SuccessModal';
import Checkbox from '../../../components/Checkbox';
import { returnBlockTime } from '../../../components/Blocktime';
import AddToCalendar from 'react-add-to-calendar';
import * as nameActions from '../../../ducks/names';
import { showError, showSuccess } from '../../../ducks/notifications';

const CAL_ITEMS = [
  { google: 'Google' },
  { apple: 'iCal' },
  { outlook: 'Outlook' },
];

class BidNow extends Component {
  static propTypes = {
    domain: PropTypes.object.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    totalBids: PropTypes.number.isRequired,
    totalMasks: PropTypes.number.isRequired,
  };

  state = {
    event: {},
    isPlacingBid: false,
    shouldAddDisguise: false,
    isReviewing: false,
    hasAccepted: false,
    bidAmount: '',
    disguiseAmount: '',
    successfullyBid: false,
    showSuccessModal: false,
  }

  async componentDidMount() {
    const event = await this.generateEvent();
    this.setState({event})
  }

  async generateEvent() {
    const { domain, network, name } = this.props;
    const { info } = domain || {};
    const { stats } = info || {};
    const { revealPeriodEnd } = stats || {};

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
    const { info } = this.props.domain || {};
    const { stats } = info || {};
    const { hoursUntilReveal } = stats || {};

    if (hoursUntilReveal < 24) {
      const hours = Math.floor(hoursUntilReveal % 24);
      const mins = Math.floor((hoursUntilReveal % 1) * 60);
      return `~${hours}h ${mins}m`
    }

    const days = Math.floor(hoursUntilReveal / 24);
    const hours = Math.floor(hoursUntilReveal % 24);
    const mins = Math.floor((hoursUntilReveal % 1) * 60);
    return `~${days}d ${hours}h ${mins}m`
  }

  render () {
    const {
      bidPeriodEnd,
      onCloseModal,
      domain,
    } = this.props;

    const {
      bidAmount,
      disguiseAmount,
      showSuccessModal,
      isPlacingBid,
    } = this.state;

    const { bids = [], info } = domain || {};
    const { highest = 0 } = info || {};

    return (
      <AuctionPanel>
        {
          showSuccessModal && (
            <SuccessModal
              bidAmount={bidAmount}
              maskAmount={Number(bidAmount) + Number(disguiseAmount)}
              revealStartBlock={bidPeriodEnd}
              onClose={onCloseModal}
            />
          )
        }
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
          <div className="domains__bid-now__info__disclaimer">
            <Tooltipable tooltipContent={'To prevent price sniping, Handshake uses a blind second-price auction called a Vickrey Auction. Users can buy and register top-level domains (TLDs) with Handshake coins (HNS).'}>
              <div className="domains__bid-now__info__icon" />
            </Tooltipable>
            Winner pays 2nd highest bid price.
          </div>
        </AuctionPanelHeader>
        {isPlacingBid ? this.renderBidNow() : this.renderOwnBidAction()}
      </AuctionPanel>
    );
  }

  renderBiddingView() {
    const {
      bidAmount,
      displayBalance,
      onChangeBidAmount,
      onClickReview,
    } = this.props;

    return (
      <AuctionPanelFooter>
        <div className="domains__bid-now__action domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__form">
            <div className="domains__bid-now__form__row">
              <div className="domains__bid-now__form__row__label">Bid Amount:</div>
              <div className="domains__bid-now__form__row__input">
                <input
                  type="number"
                  placeholder="0.00"
                  onChange={onChangeBidAmount}
                  value={bidAmount}
                />
              </div>
            </div>
            {this.renderMask()}
          </div>
          <button
            className="domains__bid-now__action__cta"
            onClick={onClickReview}
            disabled={!(bidAmount > 0)}
          >
            Review Bid
          </button>
        </div>
        <div className="domains__bid-now__action domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__HNS-status">
            {displayBalance}
          </div>
        </div>
      </AuctionPanelFooter>
    )
  }

  renderMask() {
    const {
      shouldAddDisguise,
      disguiseAmount,
      onChangeDisguiseAmount,
      onClickAddDisguise,
    } = this.props;

    if (shouldAddDisguise) {
      return (
        <div className="domains__bid-now__form__row">
          <div className="domains__bid-now__form__row__label">
            <Tooltipable
              className="domains__bid-now__mask"
              tooltipContent={(
                <span className="domains__bid-now__mask-tooltip">
                  <span>You can disguise your bid amount to cover up your actual bid. Disguise gets added on top of your bid amount, resulting in your mask. The entire mask amount will be frozen during the bidding period. </span>
                  <span>The disguise amount will be returned after the reveal period, regardless of outcome.</span>
                </span>
              )}
            >
              Disguise
            </Tooltipable>
            <span> Amount:</span>
          </div>
          <div className="domains__bid-now__form__row__input">
            <input
              type="number"
              placeholder="Optional"
              onChange={onChangeDisguiseAmount}
              value={disguiseAmount}
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className="domains__bid-now__form__link"
        onClick={onClickAddDisguise}
      >
        Add Disguise
      </div>
    )
  }

  renderOwnBidAction() {
    let { ownBid, onClickPlaceBid} = this.props;
    ownBid = false;

      if (ownBid) {
        return (
          <div className="domains__bid-now__action--placing-bid">
            <div className="domains__bid-now__title" style={{marginTop: '1rem'}}>Your Highest Bid</div>
            <div className="domains__bid-now__content">
              <div className="domains__bid-now__info">
                <div className="domains__bid-now__info__label">
                  Bid Amount
                </div>
                <div className="domains__bid-now__info__value">
                  0.01 HNS
                </div>
              </div>
              <div className="domains__bid-now__info">
                <div className="domains__bid-now__info__label">
                  Mask Amount
                </div>
                <div className="domains__bid-now__info__value">
                  0.02 HNS
                </div>
              </div>
              <div className="domains__bid-now__action">
                <button
                  className="domains__bid-now__action__cta"
                  onClick={onClickPlaceBid}
                  disabled={this.isBidPending()}
                >
                  {this.isBidPending() ? 'Bid Pending...' : 'Place Another Bid' }
                </button>
              </div>
            </div>
          </div>
        )
      }

      return (
        <AuctionPanelFooter>
          <div className="domains__bid-now__action">
            <button
              className="domains__bid-now__action__cta"
              onClick={onClickPlaceBid}
              disabled={this.isBidPending()}
            >
               {this.isBidPending() ? 'Bid Pending...' : 'Place Bid' }
            </button>
          </div>
        </AuctionPanelFooter>
      );
  }

  renderReviewing() {
    const { bidAmount, disguiseAmount, hasAccepted, editBid, editDisguise, onChangeChecked, onClickSendBid, lockup } = this.props;

    return (
      <div className="domains__bid-now__action--placing-bid" >
        <div className="domains__bid-now__title" style={{marginTop: '1rem'}}>Review Your Bid</div>
        <div className="domains__bid-now__content">
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Bid Amount:
            </div>
            <div className="domains__bid-now__info__value">
              {`${bidAmount} HNS`}
            </div>
            <div className="domains__bid-now__action__edit-icon"
              onClick={editBid}
            />
          </div>
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Disguise Amount:
            </div>
            <div className="domains__bid-now__info__value">
              {disguiseAmount ? `${disguiseAmount} HNS` : ' - '}
            </div>
            <div className="domains__bid-now__action__edit-icon"
              onClick={editDisguise}
            />
          </div>
          <div className="domains__bid-now__divider" />
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Total Mask
            </div>
            <div className="domains__bid-now__info__value">
              {`${lockup} HNS`}
            </div>
            <div className="domains__bid-now__action__placeholder" />
          </div>
        </div>

        <div className="domains__bid-now__action">
          <div className="domains__bid-now__action__agreement">
            <Checkbox
              onChange={onChangeChecked}
              checked={hasAccepted}
            />
            <div className="domains__bid-now__action__agreement-text">
              I understand my bid cannot be changed after I submit it.
            </div>
          </div>
          <button
            className="domains__bid-now__action__cta"
            onClick={onClickSendBid}
            disabled={!hasAccepted}
          >
            Submit Bid
          </button>
        </div>

      </div>
    )
  }

  isBidPending() {
    const { successfullyBid, isPending } = this.state;
    return successfullyBid || isPending;
  }

  renderBidNow() {
    const { isReviewing } = this.state;
    return isReviewing ? this.renderReviewing() : this.renderBiddingView();
  }
}

export default connect(
  (state, { domain }) => ({
    confirmedBalance: state.wallet.balance.confirmed,
    totalBids: getTotalBids(domain),
    totalMasks: getTotalMasks(domain),
    network: state.node.network,
  }),
  (dispatch, { name }) => ({
    showError: (message) => dispatch(showError(message)),
    showSuccess: (message) => dispatch(showSuccess(message)),
  }),
)(BidNow);

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
