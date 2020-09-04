import React, { Component } from 'react';
import PropTypes from 'prop-types';
import createAMPMTimeStamp from '../../utils/timeConverter';
import { displayBalance } from '../../utils/balances';
import ellipsify from '../../utils/ellipsify';
import RepairBid from './RepairBid';
import './bid-history.scss';

export default class BidHistory extends Component {
  static propTypes = {
    bids: PropTypes.array.isRequired,
    reveals: PropTypes.array.isRequired,
  };

  render() {
    const bids = this.props.bids || [];
    const reveals = this.props.reveals || [];

    if (!bids.length && !reveals.length) {
      return (
        <div className="bid-history__empty">
          No bids found.
        </div>
      );
    }

    const order = [];
    const map = {};

    bids.forEach(bid => {
      order.push(bid.from);
      map[bid.from] = {
        date: createAMPMTimeStamp(bid.date),
        bid: bid.bid.value,
        mask: bid.bid.lockup,
        own: bid.bid.own,
        name: bid.bid.name,
        from: bid.from,
        blind: bid.bid.blind,
      }
    });

    reveals.forEach(reveal => {
      const ret = map[reveal.from] || {};
      ret.bid = reveal.value;
    });

    return (
      <div className="bid-history">
        <table className="bid-history__table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Address</th>
              <th>Bid</th>
              <th>Mask</th>
            </tr>
          </thead>
          <tbody>
            {order.map(fromAddress => {
              const bid = map[fromAddress];
              const {month, day, year} = bid.date;
              let bidValue = 'Hidden Until Reveal';
              if (bid.bid == null && bid.own) {
                bidValue = <RepairBid
                  bid={bid}
                />;
              }
              if (bid.bid != null)
                bidValue = displayBalance(bid.bid, true);
              return (
                <tr key={fromAddress}>
                  <td>{month}/{day}/{year}</td>
                  <td>{bid.own ? 'You' : ellipsify(fromAddress, 10)}</td>
                  <td>{bidValue}</td>
                  <td>{displayBalance(bid.mask, true)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    );
  }
}
