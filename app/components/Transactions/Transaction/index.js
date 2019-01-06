import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import createAMPMTimeStamp from '../../../utils/timeConverter';
import '../index.scss';
import { displayBalance } from '../../../utils/balances';
import ellipsify from '../../../utils/ellipsify';
// Dummy transactions state until we have ducks

const RECEIVED = 'received';
const SENT = 'sent';


export default class Transaction extends Component {
  static propTypes = {
    transaction: PropTypes.object.isRequired
  };

  // conditional styling

  iconStyling = tx =>
    classnames('transaction__tx-icon ', {
      'transaction__tx-icon--pending': tx.pending,
      'transaction__tx-icon--received': tx.type === RECEIVED && !tx.pending,
      'transaction__tx-icon--sent': tx.type === SENT && !tx.pending
    });

  titleStyling = tx =>
    classnames('transaction__title', {
      'transaction__title--pending': tx.pending
    });

  numberStyling = tx =>
    classnames('transaction__number', {
      'transaction__number--pending': tx.pending,
      'transaction__number--positive': tx.type === RECEIVED && !tx.pending,
      'transaction__number--negative': tx.type === SENT && !tx.pending
    });

  renderTimestamp = tx => {
    const {year, month, day} = createAMPMTimeStamp(tx.date);

    return (
      <div className="transaction__tx-timestamp">
        <div className={this.titleStyling(tx)}>
          {month}/{day}/{year}
        </div>
      </div>
    );
  };

  renderDescription = tx => {
    let description = '';
    if (tx.type === SENT) {
      description = 'Sent funds';
    } else if (tx.type === RECEIVED) {
      description = 'Received funds';
    } else {
      description = 'undefined tx type';
    }

    return (
      <div className="transaction__tx-description">
        <div className={this.titleStyling(tx)}>{description}</div>
        <div className="transaction__party">
          {ellipsify(tx.type === RECEIVED ? tx.sender : tx.receiver, 12)}
        </div>
      </div>
    );
  };

  renderNumber = tx => (
    <div className="transaction__tx-value">
      <div className={this.numberStyling(tx)}>
        {tx.pending ? <em>(pending)</em> : null}
        {' '}
        {tx.type === RECEIVED ? '+' : '-'}
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
}

//TODO: Connect component to Redux and grab transactionsMap directly
