import React, {Component} from 'react';
import PropTypes from 'prop-types';
import AddToCalendar from 'react-add-to-calendar';
import Tooltipable from '../../../components/Tooltipable';


export default class Header extends Component {

  static propTypes = {
    bids: PropTypes.array.isRequired,
    highest: PropTypes.number.isRequired,
    timeRemaining: PropTypes.func.isRequired,
    items: PropTypes.array.isRequired,
    event: PropTypes.object.isRequired,
    isRevealing: PropTypes.bool,
  }

  render () {
    const { isRevealing, timeRemaining, bids, highest, event, items } = this.props;
    return (
      <React.Fragment>
        <div className="domains__bid-now__title">Auction Details</div>
        <div className="domains__bid-now__content">
          <div className="domains__bid-now__info">
            <div className="domains__bid-now__info__label">
              {isRevealing ? "Reveal Ends": "Reveal:"}
            </div>
            <div className="domains__bid-now__info__time-remaining">
              <div>
                <AddToCalendar
                  event={event}
                  listItems={items}
                />
                {timeRemaining()}
              </div>
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
          {!isRevealing && this.RenderVickreyTooltip()}
        </div>
      </React.Fragment>
    )
  }

  RenderVickreyTooltip() {
    return (
      <div className="domains__bid-now__info__disclaimer">
        <Tooltipable tooltipContent={'To prevent price sniping, Handshake uses a blind second-price auction called a Vickrey Auction. Users can buy and register top-level domains (TLDs) with Handshake coins (HNS).'}>
          <div className="domains__bid-now__info__icon" />
        </Tooltipable>
        Winner pays 2nd highest bid price.
      </div>
    )
  }
}
