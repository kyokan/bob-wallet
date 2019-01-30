import React, { Component } from 'react';
import c from 'classnames';
import AddToCalendar from 'react-add-to-calendar';
import { returnBlockTime } from '../../../components/Blocktime';

export default class OpenBid extends Component {

  state = {
    startTime: '',
    event: {},
  }

  async componentDidMount() {
    await this.getBlockTime();
    const event = await this.generateEvent();
    this.setState({ event })
  }

  async getBlockTime() {
    const { startBlock, network } = this.props;

    const startTime = await returnBlockTime(startBlock, network)
    return this.setState({ startTime: startTime.format('ll') })
  }

  async generateEvent() {
    const { startBlock, network, name} = this.props;
    const startDatetime = await returnBlockTime(startBlock, network);
    const endDatetime = startDatetime.clone().add(1, 'hours');

    const event = {
      title: `Opening of ${name}`,
      description: `The Handshake domain ${name} will be ready for bids at block ${startBlock}.`,
      location: 'The Decentralized Internet',
      startTime: startDatetime.format(),
      endTime: endDatetime.format(),
    };
    
    return event;
  }

  render() {
  let { startBlock, currentBlock, items } = this.props;

  return (
    <div className="domains__bid-now">
      <div className="domains__bid-now__title">Auction Details</div>
      <div className="domains__bid-now__content">
        <div className="domains__bid-now__info">
          <div className="domains__bid-now__info__label">
            Available:
          </div>
          <div className={c("domains__bid-now__info__value", {
            "domains__bid-now__info__value--green": startBlock <= currentBlock,
          })}>
            {startBlock <= currentBlock ? 
            'Now' : 
            <div>
              <AddToCalendar
                event={this.state.event}
                listItems={items}
                />
              {this.state.startTime} 
            </div>}
          </div>
        </div>
        <div className="domains__bid-now__info">
          <div className="domains__bid-now__info__label">
            Block Number:
          </div>
          <div className="domains__bid-now__info__value">
            {startBlock}
          </div>
        </div>
        <div className="domains__bid-now__info">
          <div className="domains__bid-now__info__label">
            Current Block:
          </div>
          <div className="domains__bid-now__info__value">
            {currentBlock}
          </div>
        </div>
      </div>
        {this.renderBottom()}
    </div>
    );
  }

  renderBottom() {
    const { onClick, isDomainOpening, startBlock, currentBlock } = this.props;

    if (isDomainOpening) {
      return (
        <div className="domains__bid-now__action--placing-bid">
          <div className="domains__bid-now__title" />
          <div className="domains__bid-now__content">
            Your open auction request is pending and will be mined within the next block.
          </div>
          <div className="domains__bid-now__action">
            <button
              className="domains__bid-now__action__cta"
              disabled
            >
              Starting Auction...
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="domains__bid-now__action--placing-bid">
        <div className="domains__bid-now__title" />
        <div className="domains__bid-now__content">
          {startBlock <= currentBlock ? 'Start the auction process by making an open bid.' : `Come back on ${this.state.startTime} to open the auction. You can add the domain to your watchlist or set a calendar invite to not miss it.`}
        </div>
        <div className="domains__bid-now__action">
          <button
            className="domains__bid-now__action__cta"
            onClick={onClick}
            disabled={!(startBlock <= currentBlock)}
          >
            Start Auction
          </button>
        </div>
      </div>
    )
  }
}