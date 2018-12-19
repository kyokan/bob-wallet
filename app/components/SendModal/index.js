import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { BigNumber as bn } from 'bignumber.js';
import { connect } from 'react-redux';
import Modal from '../Modal';
import './send.scss';
import * as walletActions from '../../ducks/wallet';

const SLOW = 'Slow';
const STANDARD = 'Standard';
const FAST = 'Fast';

const GAS_TO_ESTIMATES = {
  [SLOW]: '20-30 mins',
  [STANDARD]: '10-15 mins',
  [FAST]: 'less than 5 mins',
}

@connect(
  state => ({
    address: state.wallet.address,
  }),
  dispatch => ({
    send: ({ address, value }) => dispatch(walletActions.send({ address, value })),
  }),
)
export default class SendModal extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    send: PropTypes.func.isRequired,
    address: PropTypes.string.isRequired,
  };

  state = {
    gasFee: bn(0.00027),
    selectedGasOption: STANDARD,
    isConfirming: false,
    isSending: false,
    toAddress: '',
    amount: '',
  };

  updateToAddress = e => this.setState({ toAddress: e.target.value });
  updateAmount = e => this.setState({ amount: e.target.value });

  validate() {
    const { toAddress, amount } = this.state;

    if (!toAddress || !amount) {
      return { isValid: false };
    }

    return { isValid: true };
  }

  send = () => {
    const { toAddress: address, amount: value, isSending } = this.state;
    const { send, onClose } = this.props;

    if (isSending) {
      return;
    }

    this.setState({ isSending: true, errorMessage: '' });

    send({ address, value })
      .then(tx => {
        // TODO: Need Pending Tx UI/UX
        console.log(tx);
        this.setState({ isSending: false }, onClose);
      })
      .catch(errorMessage => this.setState({ errorMessage, isSending: false }));
  };

  renderSend() {
    const { selectedGasOption, gasFee, amount, toAddress } = this.state;
    const { onClose } = this.props;
    const { isValid } = this.validate();

    return (
      <div className="send__container">
        <div className="send__header">
          <div className="send__title">Send funds</div>
          <div className="send__close-btn" onClick={onClose}>✕</div>
        </div>
        <div className="send__content">
          <div className="send__to">
            <div className="send__label">Sending to</div>
            <div className="send__input" key="send-input">
              <input
                type="text"
                placeholder="Recipient address"
                onChange={this.updateToAddress}
                value={toAddress}
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
              <div className="send__amount-input__max-btn">Send Max</div>
              <div className="send__amount-input__unit">HNS</div>
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
                  onChange={e => this.setState({ selectedGasOption: e.target.value })}
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
            <div className="send__estimated-time">
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
      </div>
    );
  }

  renderConfirm() {
    const {
      selectedGasOption,
      gasFee,
      amount,
      toAddress,
      errorMessage,
      isSending,
    } = this.state;
    const { address, onClose } = this.props;

    return (
      <div className="send__container">
        <div className="send__header">
          <div className="send__title">Confirm Send</div>
          <div className="send__close-btn" onClick={onClose}>✕</div>
          <div
            className="send__back-btn"
            onClick={() => this.setState({ isConfirming: false })}
          />
        </div>
        <div className="send__content">
          <div className="send__confirm__from">
            <div className="send__confirm__label">Sending from:</div>
            <div className="send__confirm__address">{address}</div>
          </div>
          <div className="send__confirm__to">
            <div className="send__confirm__label">Sending to:</div>
            <div className="send__confirm__address">{toAddress}</div>
          </div>
          <div className="send__confirm__time">
            <div className="send__confirm__label">Transaction time:</div>
            <div className="send__confirm__time-text">
              {`This might take ${GAS_TO_ESTIMATES[selectedGasOption]}`}
            </div>
          </div>
          <div className="send__confirm__summary">
            <div className="send__confirm__summary-amount">
              <div className="send__confirm__summary-label">Amount to send:</div>
              <div className="send__confirm__summary-value">{`${amount} HNS`}</div>
            </div>
            <div className="send__confirm__summary-fee">
              <div className="send__confirm__summary-label">Network Fee:</div>
              <div className="send__confirm__summary-value">{`0.00005 HNS`}</div>
            </div>
            <div className="send__confirm__summary-total">
              <div className="send__confirm__summary-label">Total:</div>
              <div className="send__confirm__summary-value">{`${bn(amount).plus(0.00005).toString()} HNS`}</div>
            </div>
          </div>
        </div>
        <div className="send__confirm__error-message">
          {errorMessage}
        </div>
        <div className="send__confirm__actions">
          <button
            className="send__confirm__cancel-btn"
            onClick={onClose}
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
            { isSending ? <div className="send__confirm__spinner" /> : 'Confirm' }
          </button>
        </div>
      </div>
    );
  }

  renderContent() {
    return this.state.isConfirming
      ? this.renderConfirm()
      : this.renderSend();
  }

  render() {
    return (
      <Modal className="send" onClose={this.props.onClose}>
        { this.renderContent() }
      </Modal>
    );
  }
}
