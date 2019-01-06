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

export const ReserveInfo = () => (
  <div className="domains__action-panel domains__action-panel--gray">
    <div className="domains__action-panel__reserved-text">
      Reserved for the top 100,000 Alexa websites
    </div>
    <div className="domains__action-panel__reserved-timestamp">
      In the top 100,000 as of 6/1/18
    </div>
  </div>
);
