import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import './connect-ledger-step.scss';

export default class ConnectLedgerStep extends Component {
  static propTypes = {
    stepNumber: PropTypes.number.isRequired,
    stepDescription: PropTypes.string.isRequired,
    stepCompleted: PropTypes.bool.isRequired,
  };

  render() {
    const { stepNumber, stepDescription, stepCompleted } = this.props;
    return (
      <div className="connect__status-pill">
        <span className="connect__status-number">{stepNumber}</span>
        <span className="connect__status-text">{stepDescription}</span>
        <span className="connect__status-symbol">
          <div
            className={classNames('ledger-circle-check-container', {
              'ledger-circle-check-container__active': stepCompleted,
            })}
          />
        </span>
      </div>
    );
  }
}
