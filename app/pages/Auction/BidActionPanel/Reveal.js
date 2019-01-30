import React, {Component} from 'react';
import Header from './Header';
import { returnBlockTime } from '../../../components/Blocktime';

// TODO: Remove hardcoded information and do regression testing

export default class Reveal extends Component {

  state = {
    event: {},
  }

  async componentDidMount() {
    const event = await this.generateEvent();
    this.setState({event});
  }

  render() {
    const { timeRemaining, bids, highest, isRevealing, ownReveal, items} = this.props;

    return (
      <div className="domains__bid-now">
        <Header 
          timeRemaining={timeRemaining}
          bids={bids}
          items={items}
          event={this.state.event}
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

  async generateEvent() {
    const { revealPeriodEnd, network, name} = this.props;
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
}