import React, {Component} from 'react';
import Header from './Header';

// TODO: Implement if reveal is pending, Remove hardcoded information

export default class Reveal extends Component {

  render() {
    const { timeRemaining, bids, highest, isRevealing, ownReveal } = this.props;

    return (
      <div className="domains__bid-now">
        <Header 
          timeRemaining={timeRemaining}
          bids={bids}
          highest={highest}
          isRevealing={isRevealing}
        />
        {ownReveal ? this.renderRevealable() : 
          <div className="domains__bid-now__action">
            <button
              className="domains__bid-now__action__cta"
              disabled
            >
              No Bids to Reveal
            </button>
          </div> 
        }
      </div>
    )
  }


  isRevealPending() {
    // should return if reveal has been called and is pending
    return false
  } 

  renderRevealable() {
    const { onClickRevealBids, hasRevealableBid } = this.props;

    return (
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
              disabled={this.isRevealPending() || !hasRevealableBid}
            >
              {hasRevealableBid ? 
                (this.isRevealPending() ? 'Reveal Pending...' : 'Reveal Your Bids') :
                'Bid Successfully Revealed'
              }
            </button>
          </div>
          <div className="domains__bid-now__info__warning">
            {hasRevealableBid ? "You will lose 0.99 HNS if you don't reveal until 01/23/19." : null}
          </div>
        </div>
      </div>
    )
  }
}