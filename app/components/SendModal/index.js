import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { BigNumber as bn } from 'bignumber.js';
import { connect } from 'react-redux';
import c from 'classnames';
import './send.scss';
import { displayUnlockedConfirmBalance } from '../../utils/balances';
import * as walletActions from '../../ducks/walletActions';
import Alert from '../Alert';
import isValidAddress from '../../utils/verifyAddress';
import * as logger from '../../utils/logClient';

const SLOW = 'Slow';
const STANDARD = 'Standard';
const FAST = 'Fast';
const SIMNET = 'simnet';
// const MAINNET = 'main';

const GAS_TO_ESTIMATES = {
  [SLOW]: '20-30 mins',
  [STANDARD]: '10-15 mins',
  [FAST]: 'less than 5 mins'
};

@connect(
  state => ({
    address: state.wallet.address,
    fees: state.node.fees,
    totalBalance: displayUnlockedConfirmBalance(state.wallet.balance),
    network: state.node.network,
  }),
  dispatch => ({
    send: (to, amount, fee) => dispatch(walletActions.send(to, amount, fee))
  })
)
class SendModal extends Component {
  static propTypes = {
    send: PropTypes.func.isRequired,
    address: PropTypes.string.isRequired,
    totalBalance: PropTypes.string.isRequired,
    network: PropTypes.string.isRequired,
  };

  state = {
    selectedGasOption: STANDARD,
    isConfirming: false,
    transactionSent: false,
    isSending: false,
    to: '',
    amount: '',
    errorMessage: '',
    addressError: false,
  };

  updateToAddress = e => {
    this.setState({ to: e.target.value, errorMessage: '' });
    if (e.target.value.length > 2 && !isValidAddress(e.target.value, this.props.network)) {
      this.setState({ errorMessage: 'Invalid Address Prefix' });
    };
  }
  updateAmount = e => this.setState({ amount: e.target.value });

  validate() {
    const { to, amount } = this.state;

    if (!to || !amount || !isValidAddress(to, this.props.network)) {
      return { isValid: false };
    }

    return { isValid: true };
  }

  send = async () => {
    const { to, amount, isSending, selectedGasOption } = this.state;
    const fee = this.props.fees[selectedGasOption.toLowerCase()];

    if (isSending) {
      return;
    }

    this.setState({ isSending: true, errorMessage: '' });

    try {
      await this.props.send(to, amount, fee);
      this.setState({
        isSending: false,
        isConfirming: false,
        transactionSent: true,
        errorMessage: ''
      });
    } catch (err) {
      logger.error('failed to send transaction', { err });
      this.setState({
        errorMessage: 'Something went wrong, please try again.',
        isSending: false
      });
    }
  };

  sendMax = () => {
    const { selectedGasOption } = this.state;
    const fee = this.props.fees[selectedGasOption.toLowerCase()];

    this.setState({
      amount: bn(this.props.totalBalance).minus(fee).toFixed()
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
      isConfirming: false,
      transactionSent: false,
      isSending: false,
      to: '',
      amount: '',
      errorMessage: '',
      addressError: false,
    })
  }

  renderSend() {
    const { selectedGasOption, amount, to } = this.state;
    const { isValid } = this.validate();
    const gasFee = this.props.fees[selectedGasOption.toLowerCase()];

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
                placeholder="0.00000"
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
              {`Available to send: ${this.props.totalBalance} HNS`}
            </div>
          </div>
          <div className="send__network-fee">
            <div className="send__label">
              <span>Network Fee</span>
              <div className="send__info-icon">ⓘ</div>
            </div>
            <div className="send__network-fee__form">
              <div className="send__network-fee__select">
                <div>{selectedGasOption}</div>
                <select
                  onChange={e =>
                    this.setState({ selectedGasOption: e.target.value })
                  }
                  value={selectedGasOption}
                >
                  <option value={SLOW}>Slow</option>
                  <option value={STANDARD}>Standard</option>
                  <option value={FAST}>Fast</option>
                </select>
              </div>
              <div className="send__network-fee__fee-amount">
                {`${gasFee} HNS`}
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
            onClick={() => isValid && this.setState({ isConfirming: true })}
            disabled={!isValid}
          >
            Continue
          </button>
        </div>
        <div className="send__progress-bar">
          <div className="send__progress-bar__dot" />
          <div className={c("send__progress-bar__dot", {
            "send__progress-bar__dot--empty": !this.state.isConfirming
          })}/>
        </div>
      </div>
    );
  }

  renderConfirm() {
    const {
      selectedGasOption,
      amount,
      to,
      errorMessage,
      isSending
    } = this.state;
    const gasFee = this.props.fees[selectedGasOption.toLowerCase()];
    const { address, onClose } = this.props;

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
              {`${selectedGasOption} - this may take up to ${
                GAS_TO_ESTIMATES[selectedGasOption]
              }`}
            </div>
          </div>
          <div className="send__confirm__summary">
            <div className="send__confirm__summary-amount">
              <div className="send__confirm__summary-label">
                Amount to send:
              </div>
              <div className="send__confirm__summary-value">{`${this.addDecimalsToInteger(
                amount
              )} HNS`}</div>
            </div>
            <div className="send__confirm__summary-fee">
              <div className="send__confirm__summary-label">Network Fee:</div>
              <div className="send__confirm__summary-value">{gasFee}</div>
            </div>
            <div className="send__confirm__summary-total">
              <div className="send__confirm__summary-label">Total:</div>
              <div className="send__confirm__summary-value">{`${bn(amount)
                .plus(gasFee)
                .toFixed(6)} HNS`}</div>
            </div>
          </div>
        </div>
        <div className="send__confirm__actions">
          <button
            className="send__confirm__cancel-btn"
            onClick={() => this.setState({ isConfirming: false })}
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
          <div className={c("send__progress-bar__dot", {
            "send__progress-bar__dot--empty": !this.state.isConfirming
          })}/>
        </div>
      </div>
    );
  }

  renderTransactionSent() {
    const { amount } = this.state;
    return (
      <div className="send__container">
        <div className="send__sent__wrapper">
          <div className="send__sent__confirm-icon" />
          <div className="send__sent__headline">Transaction Sent</div>
          <div className="send__sent__description">
            {`You just sent ${this.addDecimalsToInteger(
              amount
            )} HNS to an external Handshake address.`}
          </div>
          <div className="send__sent__description">
            Your balance will update as soon as the blockchain has confirmed
            your transaction.
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
}

export default SendModal;
