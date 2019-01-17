import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import createAMPMTimeStamp from '../../utils/timeConverter';
import { displayBalance } from '../../utils/balances';
import ellipsify from '../../utils/ellipsify';
import './bid-history.scss';

class BidHistory extends Component {
  static propTypes = {
    chain: PropTypes.object.isRequired,
    bids: PropTypes.array.isRequired,
    reveals: PropTypes.array.isRequired,
  };

  render() {
    const bids = this.props.bids || [];
    const reveals = this.props.reveals || [];
    const currentHeight = this.props.chain.height;

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
              return (
                <tr key={bid.from}>
                  <td>{month}/{day}/{year}</td>
                  <td>{ellipsify(fromAddress, 10)}</td>
                  <td>{bid.bid ? displayBalance(bid.bid, true) : 'Hidden Until Reveal'}</td>
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

export default connect(
  state => ({
    chain: state.node.chain,
  }),
)(BidHistory);
