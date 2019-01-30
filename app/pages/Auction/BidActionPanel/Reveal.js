import React from 'react';
import Header from './Header';

const Reveal = (props) => {
  const { timeRemaining, bids, highest, isRevealing, onClickRevealBids } = props;
  
  //to-do: Add state handling for: no bids, revealed 

  return (
    <div className="domains__bid-now">
      <Header 
        timeRemaining={timeRemaining}
        bids={bids}
        highest={highest}
        isRevealing={isRevealing}
      />
      <div className="domains__bid-now__action--placing-bid">
            <div className="domains__bid-now__title" style={{marginTop: '1rem'}}>Your Bids</div>
            <div className="domains__bid-now__content"> 
              <div className="domains__bid-now__info">
                <div className="domains__bid-now__info__label">
                  Total Bids
                </div>
                <div className="domains__bid-now__info__value">
                  0.01 HNS
                </div>
              </div>
              <div className="domains__bid-now__info">
                <div className="domains__bid-now__info__label">
                  Total Masks
                </div>
                <div className="domains__bid-now__info__value">
                  1.00 HNS
                </div>
              </div>
              <div className="domains__bid-now__action">
                <button
                  className="domains__bid-now__action__cta"
                  onClick={onClickRevealBids}
                  disabled={isRevealPending()}
                >
                  {isRevealPending() ? 'Bid Pending...' : 'Reveal Your Bids' }
                </button>
              </div>
              <div className="domains__bid-now__info__warning">
                You will lose 0.99 HNS if you don't reveal until 01/23/19.
              </div>
            </div>
          </div>
    </div>
  )
}

const isRevealPending = () => {
  // should return if reveal has been called and is pending
  return false
}


export default Reveal;