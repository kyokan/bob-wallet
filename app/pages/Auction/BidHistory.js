import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import createAMPMTimeStamp from '../../utils/timeConverter';
import { displayBalance } from '../../utils/balances';
import ellipsify from '../../utils/ellipsify';
import RepairBid from './RepairBid';
import './bid-history.scss';
import {I18nContext} from "../../utils/i18n";

export default class BidHistory extends Component {
  static propTypes = {
    bids: PropTypes.array.isRequired,
    reveals: PropTypes.array.isRequired,
  };

  static contextType = I18nContext;

  render() {
    const bids = this.props.bids || [];
    const reveals = this.props.reveals || [];
    const {t} = this.context;

    if (!bids.length && !reveals.length) {
      return (
        <div className="bid-history__empty">
          {t('noBids')}
        </div>
      );
    }

    const order = [];
    const map = {};

    bids.forEach(bid => {
      order.push(bid.from);

      const {month, day, year} = createAMPMTimeStamp(bid.date);
      map[bid.from] = {
        date: bid.date ? `${month}/${day}/${year}` : '(pending)',
        bid: bid.bid.value,
        mask: bid.bid.lockup,
        own: bid.bid.own,
        name: bid.bid.name,
        from: bid.from,
        blind: bid.bid.blind,
        height: bid.height,
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
              <th>{t('date')}</th>
              <th>{t('address')}</th>
              <th>{t('bid')}</th>
              <th>{t('lockup')}</th>
            </tr>
          </thead>
          <tbody>
            {order.map((fromAddress, idx) => {
              const bid = map[fromAddress];
              let bidValue = t('hiddenUntilReveal');
              if (bid.bid == null && bid.own && bid.height !== -1) {
                bidValue = <RepairBid bid={bid} />;
              }
              if (bid.bid != null) {
                bidValue = displayBalance(bid.bid, true);
              }
              return (
                <tr
                  key={idx}
                  className={c({
                    "bid-history__table__tr--pending": bid.height === -1,
                  })}
                >
                  <td>{bid.date}</td>
                  <td>{bid.own ? t("you") : ellipsify(fromAddress, 10)}</td>
                  <td>{bidValue}</td>
                  <td>{displayBalance(bid.mask, true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
}
