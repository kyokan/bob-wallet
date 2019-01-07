import React, { Component } from 'react';
import PropTypes from 'prop-types';
import createAMPMTimeStamp from '../../utils/timeConverter';
import { displayBalance } from '../../utils/balances';
import ellipsify from '../../utils/ellipsify';
import './bid-history.scss';

export default class BidHistory extends Component {
  static propTypes = {
    bids: PropTypes.array.isRequired,
  };

  render() {
    if (!this.props.bids.length) {
      return (
        <div className="bid-history__empty">
          No bids found.
        </div>
      );
    }

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
            {this.props.bids.map((bid) => {
              const {month, day, year} = createAMPMTimeStamp(bid.date);
              return (
                <tr key={bid.from}>
                  <td>{month}/{day}/{year}</td>
                  <td>{ellipsify(bid.from, 10)}</td>
                  <td>{bid.bid.own ? displayBalance(bid.bid.value, true) : 'Hidden Until Reveal'}</td>
                  <td>{displayBalance(bid.bid.lockup, true)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    );
  }
}
