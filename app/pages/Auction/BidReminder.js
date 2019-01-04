import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Blocktime from '../../components/Blocktime';
import moment from 'moment';

export default class BidReminder extends Component {
  static propTypes = {
    domain: PropTypes.object,
  };

  render() {
    const { domain } = this.props;

    return (
      <div className="domains__action-panel domains__action-panel--gray">
        <div className="domains__action-panel__reminder-title">
          <span>Bidding for this domain name opens on</span>
          <Blocktime
            className="domains__action-panel__reminder-date"
            height={0}
            adjust={d => moment(d).add(domain.start.week, 'w')}
          />
        </div>
        <div className="domains__action-panel__reminder-link">
          Set reminder
        </div>
      </div>
    );
  }
}
