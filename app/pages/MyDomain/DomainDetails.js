import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import moment from 'moment';
import Blocktime from '../../components/Blocktime';
import Hash from '../../components/Hash';

class DomainDetails extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    domain: PropTypes.object.isRequired,
  };

  render() {
    const defaultStart = {};
    const { info, start = defaultStart } = this.props.domain || {};

    if (!info || !start) {
      return (
        <div className="domain-details">
          Loading...
        </div>
      )
    }

    const order = [
      ['Status', 'Closed'],
      ['Bidding Open', (
        <span>
          <Blocktime height={start.start} />
          {` (Block # ${start.start})`}
        </span>
      )],
      ['Bidding Close', (
        <span>
          <Blocktime height={info.height} />
          {` (Block # ${info.height})`}
        </span>
      )],
      ['Total Bids', info.bids ? info.bids.length : '0' ],
      ['Sold For', `${info.value} HNS`],
      ['Highest Bid', `${info.highest} HNS`],
      ['Owner', <Hash value={info.owner ? info.owner.hash : ''} />],
      ['Renew By', (
        <span>
          {moment().add(info.stats.daysUntilExpire, 'd').format('YYYY-MM-DD')}
          {` (Block # ${info.stats.renewalPeriodEnd})`}
        </span>
      )],
      ['Data', info.data],
      ['Transfered', info.transfer],
      ['Revoked', info.revoked],
      ['Claimed', info.claimed ? 'True' : 'False'],
      ['Weak', info.weak ? 'True' : 'False'],
    ];

    return (
      <div className="domain-details">
        {order.map(([k, v]) => (
          <div className="domain-detail">
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
