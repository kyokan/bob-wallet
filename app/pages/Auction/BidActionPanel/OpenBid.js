import React from 'react';

const OpenBid = (props) => {
  const {onClick} = props;
  return (
    <div className="domains__bid-now">
      <div className="domains__bid-now__title">Open Bid</div>
      <div className="domains__bid-now__content">
        Start the auction process by making an open bid.
      </div>
      <div className="domains__bid-now__action">
        <button
          className="domains__bid-now__action__cta"
          onClick={onClick}
        >
          Open Bid
        </button>
      </div>
    </div>
  );
}

export default OpenBid;