import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import moment from 'moment';
import { displayBalance } from '../../utils/balances';
import Blocktime from '../../components/Blocktime';
import Hash from '../../components/Hash';
import CopyButton from '../../components/CopyButton';
import {I18nContext} from "../../utils/i18n";

class DomainDetails extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    domain: PropTypes.object,
  };

  static contextType = I18nContext;

  render() {
    const {t} = this.context;
    const defaultStart = {};
    const { info, start = defaultStart, winner } = this.props.domain || {};

    if (!info || !start) {
      return (
        <div className="domain-details">
          {t('loading')}
        </div>
      )
    }

    const order = [
      [t('status'), t('closed')],
      [t('biddingOpen'), (
        <span>
          <Blocktime height={start.start} />
          {` (${t('block')} #${start.start})`}
        </span>
      )],
      [t('biddingClose'), (
        <span>
          <Blocktime height={info.height} />
          {` (${t('block')} #${info.height})`}
        </span>
      )],
      [t('totalBids'), `${info.bids?.length || 0} ${t('bids')}`],
      [t('soldFor'), `${info.value / 1e6} HNS`],
      [t('highestBid'), displayBalance(info.highest, true)],
      [t('owner'), (
        <div className="domain-detail__value__data">
          <Hash value={winner ? winner.address : 'ERR'} />
          { winner && <CopyButton content={winner.address} /> }
        </div>
      )],
      [t('renewBy'), (
        <span>
          {moment().add(info.stats.daysUntilExpire, 'd').format('YYYY-MM-DD')}
          {` (${t('block')} #${info.stats.renewalPeriodEnd})`}
        </span>
      )],
      [t('data'), (
        <div className="domain-detail__value__data">
          { info.data ? <Hash value={info.data} /> : 'NULL' }
          { info.data && <CopyButton content={info.data} /> }
        </div>
      )],
      [t('transferring'), info.transfer ? t('startedIn', info.transfer) : t('no')],
      [t('revoked'), info.revoked ? t('revokedIn', info.revoked) : t('no')],
      [t('claimed'), info.claimed ? t('yes') : t('no')],
      [t('weak'), info.weak ? t('yes') : t('no')],
    ];

    return (
      <div className="domain-details">
        {order.map(([k, v]) => (
          <div key={k} className="domain-detail">
            <div className="domain-detail__label">{k}:</div>
            <div className="domain-detail__value">{v}</div>
          </div>
        ))}
      </div>
    );
  }
}

export default withRouter(
  connect(
    (state, ownProps) => ({
      domain: state.names[ownProps.name],
    }),
  )(DomainDetails)
);
