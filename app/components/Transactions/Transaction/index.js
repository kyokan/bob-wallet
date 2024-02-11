import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { withRouter } from 'react-router';
import { dateTimeFormatters } from '../../../utils/timeConverter';
import '../index.scss';
import { displayBalance } from '../../../utils/balances';
import ellipsify from '../../../utils/ellipsify';
import { formatName } from '../../../utils/nameHelpers';
import Tooltipable from '../../Tooltipable';
import { shell } from 'electron';
import { I18nContext } from "../../../utils/i18n";

const RECEIVE = 'RECEIVE';
const SEND = 'SEND';
const CLAIM = 'CLAIM';
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

@connect(
  state => ({
    explorer: state.node.explorer
  })
)
class Transaction extends Component {
  static propTypes = {
    explorer: PropTypes.object.isRequired,
    transaction: PropTypes.object.isRequired,
  };

  static contextType = I18nContext;

  state = {
    isExpanded: {},
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
          || tx.type === REGISTER
          || (tx.type === FINALIZE && tx.value > 0)
          || (tx.type === TRANSFER && tx.value > 0))
        && !tx.pending,
      'transaction__number--neutral':
        (tx.type === UPDATE
          || tx.type === CLAIM
          || tx.type === RENEW
          || tx.type === OPEN
          || (tx.type === FINALIZE && tx.value === 0)
          || (tx.type === TRANSFER && tx.value === 0))
        && !tx.pending,
      'transaction__number--negative':
        (tx.type === SEND
          || tx.type === BID
          || (tx.type === FINALIZE && tx.value < 0)
          || (tx.type === TRANSFER && tx.value < 0))
        && !tx.pending,
    });

  renderTimestamp = tx => {
    const date = new Date(tx.date);
    const formattedDate = dateTimeFormatters.date.format(date);
    const formattedTime = dateTimeFormatters.time.format(date);

    return (
      <div className="transaction__tx-timestamp">
        <div className={this.titleStyling(tx)}>
          <Tooltipable tooltipContent={formattedTime} width={'4rem'} textAlign={'center'}>
            {formattedDate}
          </Tooltipable>
        </div>
      </div>
    );
  };

  renderDescription = tx => {
    const {t} = this.context;
    let description = '';
    let content = '';

    if (tx.type === SEND) {
      description = t('txDescSend');
      content = ellipsify(tx.meta.to, 12);
    } else if (tx.type === RECEIVE) {
      description = t('txDescReceive');
      content = ellipsify(tx.meta.from, 12);
    } else if (tx.type === CLAIM) {
      description = t('txDescClaim');
      content = this.formatDomains(tx);
    } else if (tx.type === OPEN) {
      description = t('txDescOpen');
      content = this.formatDomains(tx);
    } else if (tx.type === BID) {
      description = t('txDescBid');
      content = this.formatDomains(tx);
    } else if (tx.type === REVEAL) {
      description = t('txDescReveal');
      content = this.formatDomains(tx);
    } else if (tx.type === UPDATE) {
      description = t('txDescUpdate');
      content = this.formatDomains(tx);
    } else if (tx.type === REGISTER) {
      description = t('txDescRegister');
      content = this.formatDomains(tx);
    } else if (tx.type === RENEW) {
      description = t('txDescRenew');
      content = this.formatDomains(tx);
    } else if (tx.type === REDEEM) {
      description = t('txDescRedeem');
      content = this.formatDomains(tx);
    } else if (tx.type === COINBASE) {
      description = t('txDescCoinbase');
    } else if (tx.type === TRANSFER) {
      description = t('txDescTransfer');
      content = this.formatDomains(tx);
    } else if (tx.type === REVOKE) {
      description = t('txDescRevoke');
      content = this.formatDomains(tx);
    } else if (tx.type === 'FINALIZE') {
      description = t('txDescFinalize');
      if (tx.value > 0) description = 'Received Payment for Domain';
      if (tx.value < 0) description = 'Finalized With Payment';
      content = this.formatDomains(tx);
    } else {
      description = t('txDescUnknown');
    }

    if (tx.domains?.length > 1) {
      description += ` (${tx.domains.length} ${t('domainsPlural')})`;
    } else {
      description += tx.meta.multiple ? ` (${t('txDescMultiple')})` : '';
    }

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
          [RECEIVE, COINBASE, REDEEM, REVEAL, REGISTER].includes(tx.type)
            ? '+'
            : [UPDATE, RENEW, OPEN, FINALIZE, CLAIM].includes(tx.type)
              ? ''
              : [SEND, BID].includes(tx.type)
                ? '-'
                : ''
        }
        {(tx.type === FINALIZE && tx.value > 0) ? '+' : ''}
        {(tx.type === TRANSFER && tx.value > 0) ? '+' : ''}
        {displayBalance(tx.value)} HNS
      </div>
    </div>
  );

  render() {
    const { transaction } = this.props;

    return (
      <div className="transaction">
        {this.renderTimestamp(transaction)}
        {this.renderDescription(transaction)}
        {this.renderNumber(transaction)}
      </div>
    );
  }

  formatDomains(tx) {
    const { t } = this.context;
    const { id, domains } = tx;

    if (!domains?.length) {
      return `(${this.context.t('unknown')})`;
    }

    const expanded = this.state.isExpanded[id]
    const domainsToDisplay = expanded ? domains : domains.slice(0, 1);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: expanded ? "column" : null,
        }}
      >
        {/* Domains list */}
        <div
          className={classnames("transaction__party__container", {
            "transaction__party__container--expanded": expanded,
          })}
        >
          {domainsToDisplay.map((domain, idx) => (
            <div
              key={idx}
              className="transaction__tld-link"
              onClick={() => this.props.history.push(`/domain/${domain}`)}
            >
              {formatName(domain)}
            </div>
          ))}
        </div>

        {/* Expand / Collapse button */}
        {domains.length > 1 ? (
          <span
            className="transaction__party__btn"
            onClick={() =>
              this.setState((prevState) => ({
                isExpanded: {
                  ...prevState.isExpanded,
                  [id]: !expanded,
                },
              }))
            }
          >
            {" "}
            {t(expanded ? "collapse" : "viewAll")}
          </span>
        ) : null}
      </div>
    );
  }

  onClickTitle = () => {
    shell.openExternal(this.props.explorer.tx.replace('%s', this.props.transaction.id));
  };
};

export default withRouter(Transaction);
