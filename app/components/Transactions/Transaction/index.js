import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { withRouter } from 'react-router';
import createAMPMTimeStamp from '../../../utils/timeConverter';
import '../index.scss';
import { displayBalance } from '../../../utils/balances';
import ellipsify from '../../../utils/ellipsify';
import Tooltipable from '../../Tooltipable';
import { shell } from 'electron';

const RECEIVE = 'RECEIVE';
const SEND = 'SEND';
const OPEN = 'OPEN';
const BID = 'BID';
const REVEAL = 'REVEAL';
const UPDATE = 'UPDATE';
const RENEW = 'RENEW';
const REDEEM = 'REDEEM';
const COINBASE = 'COINBASE';
const REGISTER = 'REGISTER';
const TRANSFER = 'TRANSFER';
const REVOKE = 'REVOKE';
const FINALIZE = 'FINALIZE';

class Transaction extends Component {
  static propTypes = {
    transaction: PropTypes.object.isRequired,
  };

  // conditional styling

  iconStyling = tx =>
    classnames('transaction__tx-icon ', {
      'transaction__tx-icon--pending': tx.pending,
      'transaction__tx-icon--received': (tx.type === RECEIVE || tx.type === COINBASE) && !tx.pending,
      'transaction__tx-icon--sent': tx.type === SEND && !tx.pending,
    });

  titleStyling = tx =>
    classnames('transaction__title', {
      'transaction__title--pending': tx.pending,
    });

  numberStyling = tx =>
    classnames('transaction__number', {
      'transaction__number--pending': tx.pending,
      'transaction__number--positive':
        (tx.type === RECEIVE
          || tx.type === COINBASE
          || tx.type === REVEAL
          || tx.type === REDEEM
          || tx.type === REGISTER)
        && !tx.pending,
      'transaction__number--neutral':
        (tx.type === UPDATE
          || tx.type === RENEW
          || tx.type === OPEN
          || tx.type === TRANSFER
          || tx.type === FINALIZE)
        && !tx.pending,
      'transaction__number--negative':
        (tx.type === SEND
          || tx.type === BID)
        && !tx.pending,
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
      description = 'Sent Funds';
      content = ellipsify(tx.meta.to, 12);
    } else if (tx.type === RECEIVE) {
      description = 'Received Funds';
      content = ellipsify(tx.meta.from, 12);
    } else if (tx.type === OPEN) {
      description = 'Opened Auction';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === BID) {
      description = 'Placed Bid';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === REVEAL) {
      description = 'Revealed Bid';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === UPDATE) {
      description = 'Updated Record';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === REGISTER) {
      description = 'Registered Name';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === RENEW) {
      description = 'Renewed Domain';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === REDEEM) {
      description = 'Redeemed Bid';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === COINBASE) {
      description = 'Mining Reward';
    } else if (tx.type === TRANSFER) {
      description = 'Transferred Domain';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === REVOKE) {
      description = 'Revoked Domain';
      content = this.formatDomain(tx.meta.domain);
    } else if (tx.type === 'FINALIZE') {
      description = 'Finalized Domain';
      content = this.formatDomain(tx.meta.domain);
    } else {
      description = 'Unknown Transaction';
    }

    description += tx.meta.multiple ? ' (multiple)' : '';

    return (
      <div className="transaction__tx-description">
        <div className={this.titleStyling(tx)} onClick={this.onClickTitle}>{description}</div>
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
        {
          tx.type === RECEIVE || tx.type === COINBASE || tx.type === REDEEM || tx.type === REVEAL || tx.type === REGISTER ? '+'
            : tx.type === UPDATE || tx.type === RENEW || tx.type === OPEN ? ''
            : '-'
        }
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

  onClickTitle = () => {
    shell.openExternal(`https://hnscan.com/tx/${this.props.transaction.id}`);
  };
};

export default withRouter(Transaction);
