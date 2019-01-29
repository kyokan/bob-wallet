import React from 'react';
import SuccessModal from '../../../components/SuccessModal';

const PlacedBid = (props) => {
  const {children} = props
  return (
    <div className="domains__bid-now">
    {showSuccessModal &&
      <SuccessModal
        bidAmount={bidAmount}
        maskAmount={Number(bidAmount) + Number(disguiseAmount)}
        revealStartBlock={bidPeriodEnd}
        onClose={onClose}
      />}
    <div className="domains__bid-now__title">Bid placed!</div>
    <div className="domains__bid-now__content">
      {children}
    </div>
  </div>
  );
}

export default PlacedBid;