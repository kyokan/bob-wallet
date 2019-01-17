import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { withRouter } from 'react-router';
import createAMPMTimeStamp from '../../../utils/timeConverter';
import '../index.scss';
import { displayBalance } from '../../../utils/balances';
import ellipsify from '../../../utils/ellipsify';
import Tooltipable from '../../Tooltipable';

const RECEIVE = 'RECEIVE';
const SEND = 'SEND';
const OPEN = 'OPEN';
const BID = 'BID';
const REVEAL = 'REVEAL';
const UPDATE = 'UPDATE';
const RENEW = 'RENEW';

class Transaction extends Component {
  static propTypes = {
    transaction: PropTypes.object.isRequired
  };

  // conditional styling

  iconStyling = tx =>
    classnames('transaction__tx-icon ', {
      'transaction__tx-icon--pending': tx.pending,
      'transaction__tx-icon--received': tx.type === RECEIVE && !tx.pending,
      'transaction__tx-icon--sent': tx.type === SEND && !tx.pending
    });

  titleStyling = tx =>
    classnames('transaction__title', {
      'transaction__title--pending': tx.pending
    });

  numberStyling = tx =>
    classnames('transaction__number', {
      'transaction__number--pending': tx.pending,
      'transaction__number--positive': tx.type === RECEIVE && !tx.pending,
      'transaction__number--negative': tx.type !== RECEIVE && !tx.pending
    });

  renderTimestamp = tx => {
    const {year, month, day, time} = createAMPMTimeStamp(tx.date);

    return (
      <div className="transaction__tx-timestamp">
        <div className={this.titleStyling(tx)}>
          <Tooltipable tooltipContent={time} width={'4rem'} textAlign={'center'}>
            {month}/{day}/{year}
          </Tooltipable>
        </div>
      </div>
    );
  };

  renderDescription = tx => {
    let description = '';
    let content = '';
    if (tx.type === SEND) {
      description = 'Sent funds';
      content = ellipsify(tx.meta.to, 12);
    } else if (tx.type === RECEIVE) {
      description = 'Received funds';
      content = ellipsify(tx.meta.from, 12);
    } else if (tx.type === OPEN) {
      description = 'Opened bid';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === BID) {
      description = 'Placed bid';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === REVEAL){
      description = 'Revealed bid';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === UPDATE) {
      description = 'Updated Record';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === RENEW) {
      description = 'Renew Domain';
      content = this.formatDomain(tx.meta.domain);
    } else {
      description = 'Unknown Transaction';
    }

    return (
      <div className="transaction__tx-description">
        <div className={this.titleStyling(tx)}>{description}</div>
        <div className="transaction__party">
          {content}
        </div>
      </div>
    );
  };

  renderNumber = tx => (
    <div className="transaction__tx-value">
      <div className={this.numberStyling(tx)}>
        {tx.pending ? <em>(pending)</em> : null}
        {' '}
        {tx.type === RECEIVE ? '+' : '-'}
        {displayBalance(tx.value)} HNS
      </div>
    </div>
  );

  render() {
    const {transaction} = this.props;

    return (
      <div className="transaction">
        {this.renderTimestamp(transaction)}
        {this.renderDescription(transaction)}
        {this.renderNumber(transaction)}
      </div>
    );
  }

  formatDomain(domain) {
    return domain
      ? (
        <div
          className="transaction__tld-link"
          onClick={() => this.props.history.push(`/domain/${domain}`)}
        >
          {`${domain}/`}
        </div>
      )
      : '(unknown)';
  }
};

export default withRouter(Transaction);
