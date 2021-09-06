import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { BigNumber as bn } from 'bignumber.js';
import { connect } from 'react-redux';
import c from 'classnames';
import './send.scss';
import { displayBalance, toDisplayUnits } from '../../utils/balances';
import * as walletActions from '../../ducks/walletActions';
import Alert from '../Alert';
import isValidAddress from '../../utils/verifyAddress';
import * as logger from '../../utils/logClient';
import { clientStub as aClientStub } from '../../background/analytics/client';
import walletClient from '../../utils/walletClient';
import { shell } from 'electron';

const Sentry = require('@sentry/electron');

const analytics = aClientStub(() => require('electron').ipcRenderer);

const SLOW = 'Slow';
const STANDARD = 'Standard';
const FAST = 'Fast';
const SIMNET = 'simnet';
// const MAINNET = 'main';

const GAS_TO_ESTIMATES = {
  [SLOW]: '20-30 mins',
  [STANDARD]: '10-15 mins',
  [FAST]: 'less than 5 mins',
};

@connect(
  state => ({
    address: state.wallet.address,
    fees: state.node.fees,
    spendableBalance: state.wallet.balance.spendable,
    network: state.wallet.network,
    explorer: state.node.explorer,
  }),
  dispatch => ({
    send: (to, amount, fee) => dispatch(walletActions.send(to, amount, fee)),
  }),
)
class SendModal extends Component {
  static propTypes = {
    send: PropTypes.func.isRequired,
    address: PropTypes.string.isRequired,
    spendableBalance: PropTypes.number.isRequired,
    network: PropTypes.string.isRequired,
    explorer: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);

    this.state = {
      selectedGasOption: STANDARD,
      gasFee: props.fees[STANDARD.toLowerCase()],
      isConfirming: false,
      transactionSent: false,
      transactionHash: '',
      isSending: false,
      to: '',
      amount: '',
      errorMessage: '',
      addressError: false,
      feeAmount: 0,
      txSize: 0,
    };
  }

  componentDidMount() {
    analytics.screenView('Send');
  }

  updateToAddress = e => {
    this.setState({to: e.target.value, errorMessage: ''});
    if (e.target.value.length > 2 && !isValidAddress(e.target.value, this.props.network)) {
      this.setState({errorMessage: 'Invalid Address Prefix'});
    }
  };

  updateAmount = e => this.setState({amount: e.target.value, errorMessage: ''});

  validate() {
    const {to, amount} = this.state;

    if (!to || !amount || !isValidAddress(to, this.props.network)) {
      return {isValid: false};
    }

    return {isValid: true};
  }

  send = async () => {
    const {to, amount, isSending, gasFee} = this.state;
    if (isSending) {
      return;
    }
    this.setState({isSending: true, errorMessage: ''});

    try {
      const res = await this.props.send(to, amount, gasFee);
      this.setState({
        isSending: false,
        isConfirming: false,
        transactionSent: true,
        errorMessage: '',
        transactionHash: res.hash
      });
      analytics.track('sent coins', {
        selectedGasOption,
      });
    } catch (err) {
      logger.error('failed to send transaction', {err});
      this.setState({
        errorMessage: `Something went wrong: ${err ? err.message : 'Unknown Error'}`,
        isSending: false,
      });
    }
  };

  sendMax = async () => {
    this.setState({errorMessage: ''});
    const fee = this.state.gasFee;

    let maxBal;
    try {
      maxBal = await walletClient.estimateMaxSend(fee);
    } catch (e) {
      this.setState({
        errorMessage: `Something went wrong: ${e.message}`,
      });
      return;
    }

    this.setState({
      amount: maxBal,
    });
  };

  onClickContinue = async () => {
    if (!this.validate()) {
      return;
    }

    let feeInfo;
    try {
      feeInfo = await walletClient.estimateTxFee(this.state.to, this.state.amount, this.state.gasFee);
    } catch (e) {
      this.setState({
        errorMessage: e.message,
      });
      return;
    }

    this.setState({
      feeAmount: feeInfo.amount,
      txSize: feeInfo.txSize,
      isConfirming: true,
    });
  };

  addDecimalsToInteger(amount) {
    if (amount % 1 === 0) {
      return bn(amount).toFixed(2);
    }
    return amount;
  }

  resetState() {
    this.setState({
      selectedGasOption: STANDARD,
      gasFee: this.props.fees[STANDARD.toLowerCase()],
      isConfirming: false,
      transactionSent: false,
      isSending: false,
      to: '',
      amount: '',
      errorMessage: '',
      addressError: false,
      feeAmount: 0,
      txSize: 0,
    });
  }

  renderSend() {
    const {selectedGasOption, amount, to} = this.state;
    const {isValid} = this.validate();

    return (
      <div className="send__container">
        <div className="send__content">
          <div className="send__header">
            <div className="send__title">Send Funds</div>
          </div>
          <Alert type="error" message={this.state.errorMessage} />
          <div className="send__to">
            <div className="send__label">Sending to</div>
            <div className="send__input" key="send-input">
              <input
                type="text"
                placeholder="Recipient address"
                onChange={this.updateToAddress}
                value={to}
              />
            </div>
          </div>
          <div className="send__amount">
            <div className="send__label">Amount</div>
            <div className="send__amount-input" key="send-amount">
              <input
                type="number"
                min={0}
                placeholder="0.000000"
                onChange={this.updateAmount}
                value={amount}
              />
              <div
                className="send__amount-input__max-btn"
                onClick={this.sendMax}
              >
                Send Max
              </div>
              <div className="send__amount-input__unit">HNS</div>
            </div>
            <div className="send__input-disclaimer">
              {`Available to send (including fee): ${displayBalance(this.props.spendableBalance)}`}
            </div>
          </div>
          <div className="send__network-fee">
            <div className="send__label">
              <span>Network Fee Rate</span>
              <div className="send__info-icon">ⓘ</div>
            </div>
            <div className="send__network-fee__form">
              <div className="send__network-fee__select">
                <div>{selectedGasOption}</div>
                <select
                  onChange={e => this.setState({
                    selectedGasOption: e.target.value,
                    gasFee: this.props.fees[e.target.value.toLowerCase()],
                  })}
                  value={selectedGasOption}
                >
                  <option value={SLOW}>Slow</option>
                  <option value={STANDARD}>Standard</option>
                  <option value={FAST}>Fast</option>
                </select>
              </div>
              <div className="send__network-fee__fee-amount">
                <input
                  value={this.state.gasFee}
                  onChange={(e) => this.setState({gasFee: e.target.value})}
                  type="number"
                />
              </div>
            </div>
            <div className="send__input-disclaimer">
              {`Est. delivery: ${GAS_TO_ESTIMATES[selectedGasOption]}`}
            </div>
          </div>
        </div>
        <div className="send__actions">
          <button
            className="send__cta-btn"
            key="continue"
            onClick={this.onClickContinue}
            disabled={!isValid}
          >
            Continue
          </button>
        </div>
        <div className="send__progress-bar">
          <div className="send__progress-bar__dot" />
          <div className={c('send__progress-bar__dot', {
            'send__progress-bar__dot--empty': !this.state.isConfirming,
          })} />
        </div>
      </div>
    );
  }

  renderConfirm() {
    const {
      gasFee,
      amount,
      to,
      isSending,
      feeAmount,
      txSize,
    } = this.state;

    return (
      <div className="send__container">
        <div className="send__content">
          <div className="send__header">
            <div className="send__title">Confirm Transaction</div>
          </div>
          <Alert type="error" message={this.state.errorMessage} />
          <div className="send__confirm__to">
            <div className="send__confirm__label">Sending to</div>
            <div className="send__confirm__address">{to}</div>
          </div>
          <div className="send__confirm__from">
            <div className="send__confirm__label">Sending from</div>
            <div className="send__confirm__time-text">Default account</div>
          </div>
          <div className="send__confirm__time">
            <div className="send__confirm__label">Transaction time</div>
            <div className="send__confirm__time-text">
              {this.renderConfirmTime()}
            </div>
          </div>
          <div className="send__confirm__summary">
            <div className="send__confirm__summary-amount">
              <div className="send__confirm__summary-label">
                Amount to send:
              </div>
              <div className="send__confirm__summary-value">{`${this.addDecimalsToInteger(
                amount,
              )} HNS`}</div>
            </div>
            <div className="send__confirm__summary-fee">
              <div className="send__confirm__summary-label">Network Fee Rate:</div>
              <div className="send__confirm__summary-value">{gasFee} HNS/kB</div>
            </div>
            <div className="send__confirm__summary-fee">
              <div className="send__confirm__summary-label">Estimated TX Size:</div>
              <div className="send__confirm__summary-value">{txSize} kB</div>
            </div>
            <div className="send__confirm__summary-fee">
              <div className="send__confirm__summary-label">Estimated Fee:</div>
              <div className="send__confirm__summary-value">{feeAmount}</div>
            </div>
            <div className="send__confirm__summary-total">
              <div className="send__confirm__summary-label">Total:</div>
              <div className="send__confirm__summary-value">{`${bn(amount)
                .plus(feeAmount)
                .toFixed(6)} HNS`}</div>
            </div>
          </div>
        </div>
        <div className="send__confirm__actions">
          <button
            className="send__confirm__cancel-btn"
            onClick={() => this.setState({isConfirming: false})}
            disabled={isSending}
          >
            Cancel
          </button>
          <button
            key="confirm"
            className="send__confirm__cta-btn"
            onClick={this.send}
            disabled={isSending}
          >
            {isSending ? <div className="send__confirm__spinner" /> : 'Confirm'}
          </button>
        </div>
        <div className="send__progress-bar">
          <div className="send__progress-bar__dot" />
          <div className={c('send__progress-bar__dot', {
            'send__progress-bar__dot--empty': !this.state.isConfirming,
          })} />
        </div>
      </div>
    );
  }

  renderTransactionSent() {
    const {amount} = this.state;
    return (
      <div className="send__container">
        <div className="send__sent__wrapper">
          <div className="send__sent__confirm-icon" />
          <div className="send__sent__headline">Transaction Sent</div>
          <div className="send__sent__description">
            {`You just sent ${this.addDecimalsToInteger(
              amount,
            )} HNS to an external Handshake address.`}
          </div>
          <div className="send__sent__details send__sent__details-first" onClick={this.viewOnExplorer}>
            View on Explorer
          </div>
          <div className="send__sent__details" onClick={() => this.resetState()}>Create New Transaction</div>
        </div>
      </div>
    );
  }

  renderContent() {
    if (this.state.transactionSent) {
      return this.renderTransactionSent();
    }
    if (this.state.isConfirming) {
      return this.renderConfirm();
    }
    return this.renderSend();
  }

  render() {
    return this.renderContent();
  }

  viewOnExplorer = () => {
    shell.openExternal(this.props.explorer.tx.replace('%s', this.state.transactionHash));
  };

  renderConfirmTime() {
    const {selectedGasOption, gasFee} = this.state;
    if (gasFee === this.props.fees[selectedGasOption.toLowerCase()]) {
      return `${selectedGasOption} - this may take up to ${
        GAS_TO_ESTIMATES[selectedGasOption]
      }`;
    }

    return 'You entered a custom gas fee, so we don\'t have an estimate.';
  }
}

export default SendModal;
