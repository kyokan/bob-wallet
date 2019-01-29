import React from 'react';
import Tooltipable from '../../../components/Tooltipable';

const BidNow = (props) => {
  const {children, timeRemaining, bids, highest} = props;
  return (
    <div className="domains__bid-now">
      <div className="domains__bid-now__title">Bid Now!</div>
      <div className="domains__bid-now__content">
        <div className="domains__bid-now__info">
          <div className="domains__bid-now__info__label">
            Time Remaining:
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
      {children}
    </div>
  );
}

export default BidNow;