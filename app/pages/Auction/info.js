/* eslint-disable react/prop-types,no-use-before-define */
import React, { Component } from 'react';
import Hash from '../../components/Hash';
import { displayBalance } from '../../utils/balances';
import ellipsify from '../../utils/ellipsify';


export const SoldInfo = ({ owner, highestBid, domain, onRedeem }) => {
  let btn = null;

  if (hasRedeemableReveals(domain)) {
    btn = (
      <button
        className="domains__action-panel__redeem-btn"
        onClick={onRedeem}
      >
        Redeem my bid
      </button>
    );
  }

  if (domain.pendingOperation === 'REDEEM') {
    btn = (
      <button
        className="domains__action-panel__redeem-btn"
        disabled
      >
        Redeeming
      </button>
    );
  }


  return (
    <div className="domains__action-panel">
      <div className="domains__bid-now__title">Domain is no longer available</div>
      <div className="domains__bid-now__content">
        <div className="domains__bid-now__info">
          <div className="domains__bid-now__info__label">
            Highest bid:
          </div>
          <div className="domains__bid-now__info__value">
            {displayBalance(highestBid, true)}
          </div>
        </div>
        <div className="domains__bid-now__info">
          <div className="domains__bid-now__info__label">
            Winner:
          </div>
          <div className="domains__bid-now__info__value">
            {ellipsify(owner, 10)}
          </div>
        </div>
        { btn }
      </div>
    </div>
  );
};

function hasRedeemableReveals(domain) {
  const reveals = domain.reveals || [];

  for (let i = 0; i < reveals.length; i++) {
    const reveal = reveals[i];
    if (reveal.bid.own && reveal.height >= domain.info.height) {
      if (reveal.redeemable) {
        return true;
      }
    }
  }

  return false;
}

export const PendingRenewInfo = ({ onManageDomain }) => (
  <div className="domains__action-panel">
    <div className="domains__bid-now__title">You are the owner of this domain!</div>
    <div className="domains__bid-now__content">
      <button
        className="domains__action-panel__renew-domain-btn"
        disabled
      >
        Renewing
      </button>
      <button
        className="domains__action-panel__manage-domain-btn"
        onClick={onManageDomain}
      >
        Manage my domain
      </button>
    </div>
  </div>
);

export const OwnedInfo = ({ onClick, onRenewalClick }) => (
  <div className="domains__action-panel">
    <div className="domains__bid-now__title">You are the owner of this domain!</div>
    <div className="domains__bid-now__content">
      { onRenewalClick && (
        <button
          className="domains__action-panel__renew-domain-btn"
          onClick={onRenewalClick}
        >
          Renew my domain
        </button>
      )}
      <button
        className="domains__action-panel__manage-domain-btn"
        onClick={onClick}
      >
        Manage my domain
      </button>
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
