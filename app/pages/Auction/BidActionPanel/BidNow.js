import React, {Component} from 'react';
import Tooltipable from '../../../components/Tooltipable';
import SuccessModal from '../../../components/SuccessModal';
import Checkbox from '../../../components/Checkbox';

export default class BidNow extends Component {

  render () {
    let { timeRemaining, bids, highest, isPlacingBid, showSuccessModal, bidAmount, disguiseAmount, bidPeriodEnd, onCloseModal, isReviewing } = this.props;

    return (
      <div className="domains__bid-now">
          {showSuccessModal &&
            <SuccessModal
              bidAmount={bidAmount}
              maskAmount={Number(bidAmount) + Number(disguiseAmount)}
              revealStartBlock={bidPeriodEnd}
              onClose={onCloseModal}
            />}
        <div className="domains__bid-now__title">Auction Details</div>
        <div className="domains__bid-now__content">
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Reveal:
            </div>
            <div className="domains__bid-now__info__time-remaining">
              {timeRemaining()}
            </div>
          </div>
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Total Bids:
            </div>
            <div className="domains__bid-now__info__value">
              {bids.length}
            </div>
          </div>
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              Highest <span>Mask</span>:
            </div>
            <div className="domains__bid-now__info__value">
              {highest}
            </div>
          </div>
          <div className="domains__bid-now__info__disclaimer">
            <Tooltipable tooltipContent={'To prevent price sniping, Handshake uses a blind second-price auction called a Vickrey Auction. Users can buy and register top-level domains (TLDs) with Handshake coins (HNS).'}>
              <div className="domains__bid-now__info__icon" />
            </Tooltipable>
            Winner pays 2nd highest bid price.
          </div>
        </div>
        {isPlacingBid ? (isReviewing ? this.renderReviewing() : this.renderBidNowAction()) : this.renderOwnBidAction()}
      </div>
    );
  }

  renderBidNowAction() {
    const { bidAmount, displayBalance, onChangeBidAmount, onClickReview} = this.props;
    return (
      <React.Fragment>
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
      </React.Fragment>
    )
  }

  renderMask() {
    const {shouldAddDisguise, disguiseAmount, onChangeDisguiseAmount, onClickAddDisguise} = this.props;

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
    ownBid = true;

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
        <div className="domains__bid-now__action">
          <button
            className="domains__bid-now__action__cta"
            onClick={onClickPlaceBid}
            disabled={this.isBidPending()}
          >
             {this.isBidPending() ? 'Bid Pending...' : 'Place Bid' }
          </button>
        </div>
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
    const { successfullyBid, isPending } = this.props
    return successfullyBid || isPending;
  }
}