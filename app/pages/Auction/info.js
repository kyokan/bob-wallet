/* eslint-disable react/prop-types,no-use-before-define */
import React from 'react';
import Hash from '../../components/Hash';


export const SoldInfo = ({ owner, paidValue }) => (
  <div className="domains__action-panel">
    <div className="domains__bid-now__title">Domain sold</div>
    <div className="domains__bid-now__content">
      <div className="domains__bid-now__info">
        <div className="domains__bid-now__info__label">
          Owner:
        </div>
        <div className="domains__bid-now__info__value">
          <Hash value={owner} />
        </div>
      </div>
      <div className="domains__bid-now__info">
        <div className="domains__bid-now__info__label">
          Sold for:
        </div>
        <div className="domains__bid-now__info__value">
          {`${paidValue} HNS`}
        </div>
      </div>
    </div>
  </div>
);

export const CloseInfo = ({ biddingCloseDate, bids }) => (
  <div className="auction__right">
    <div className="auction__bid-box">
      <div className="auction__title auction__col-1">
        Highest bid:
      </div>
      <div className="auction__hidden-message auction__col-1">
        {
          biddingCloseDate
            ? `Hidden until ${biddingCloseDate.getMonth() + 1}/${biddingCloseDate.getDate()}/${biddingCloseDate.getFullYear()}`
            : ''
        }
      </div>
      <div className="auction__align-end auction__bid-amount auction__col-2 auction__bid-total">
        { `${bids.length} bids` }
      </div>
      <div className="auction__large auction__bid-label">
        Your bid:
      </div>
      <div className="auction__col-1 auction__input-container">
        <div className="auction__input">
          <input type="number" />
          <span>HNS</span>
        </div>
      </div>
      <div className="auction__btn-container">
        <button className="auction__button auction__col-2">Place Bid</button>
      </div>
      {/*TODO change auction__limited-time name in css*/}
      <div className="auction__limited-time auction__small-text auction__col-1-to-3">
        {'Winner pays 2nd highest bid price. If there is only one bidder, bidder gets this name for free.'}
      </div>
    </div>
  </div>
);

export const ReserveInfo = () => (
  <div className="domains__action-panel domains__action-panel--gray">
    <div className="domains__action-panel__reserved-text">
      Reserved for the top 100,000 Alexa websites
    </div>
    <div className="domains__action-panel__reserved-timestamp">
      Alex websites as of 6/1/18
    </div>
  </div>
);
