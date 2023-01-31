import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { BigNumber as bn } from 'bignumber.js';
import { connect } from 'react-redux';
import c from 'classnames';
import './send.scss';
import { displayBalance } from '../../utils/balances';
import * as walletActions from '../../ducks/walletActions';
import Alert from '../Alert';
import AddressInput from '../AddressInput';
import isValidAddress from '../../utils/verifyAddress';
import * as logger from '../../utils/logClient';
import { clientStub as aClientStub } from '../../background/analytics/client';
import walletClient from '../../utils/walletClient';
import { shell } from 'electron';
import {I18nContext} from "../../utils/i18n";
import LockSVG from '../../assets/images/lock.svg';

const analytics = aClientStub(() => require('electron').ipcRenderer);

const SLOW = 'Slow';
const STANDARD = 'Standard';
const FAST = 'Fast';

@connect(
  state => ({
    isSynchronized: state.node.isRunning && (state.node.chain || {}).progress >= 0.99,
    address: state.wallet.receiveAddress,
    fees: state.node.fees,
    spendableBalance: state.wallet.balance.spendable,
    network: state.wallet.network,
    noDns: state.node.noDns,
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

  static contextType = I18nContext;

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
      hip2Domain: '',
      amount: '',
      errorMessage: '',
      addressError: false,
      feeAmount: 0,
      txSize: 0,
    };
  }

  openLinkHandler (e) {
    e.preventDefault()
    shell.openExternal(e.target.href)
  }

  componentDidMount = () => {
    analytics.screenView('Send');
  }

  updateAmount = e => this.setState({amount: e.target.value, errorMessage: ''});

  validate() {
    const {to, amount} = this.state;

    if (!to || !amount || !isValidAddress(to, this.props.network)) {
      return {isValid: false};
    }

    return {isValid: true};
  }

  send = async () => {
    const {to, amount, isSending, gasFee, selectedGasOption} = this.state;
    if (isSending) {
      return;
    }
    this.setState({isSending: true, errorMessage: ''});

    try {
      const res = await this.props.send(to, amount, gasFee);
      this.setState({
        isSending: false,
        isConfirming: false,
        transactionSent: res !== null,
        errorMessage: '',
        transactionHash: (res && res.hash) || '',
      });
      analytics.track('sent coins', {
        selectedGasOption,
      });
    } catch (err) {
      logger.error('failed to send transaction', {err});
      this.setState({
        errorMessage: `${this.context.t('genericError')}: ${err ? err.message : 'Unknown Error'}`,
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
        errorMessage: `${this.context.t('genericError')}: ${e?.message}`,
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
    const {selectedGasOption, amount} = this.state;
    const {t} = this.context;
    const {isValid} = this.validate();

    return (
      <div className="send__container">
        <div className="send__content">
          <div className="send__header">
            <div className="send__title">{t('sendTitle')}</div>
          </div>
          <Alert type="error" message={this.state.errorMessage} />
          <div className="send__to">
            <div className="send__label">{t('sendToLabel')}</div>
            <AddressInput
              onAddress={({domain, address}) => this.setState({
                to: address,
                hip2Domain: domain,
              })}
            />
          </div>
          <div className="send__amount">
            <div className="send__label">{t('amount')}</div>
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
                {t('sendMaxLabel')}
              </div>
              <div className="send__amount-input__unit">HNS</div>
            </div>
            <div className="send__input-disclaimer">
              {t('sendAvailableText', displayBalance(this.props.spendableBalance))}
            </div>
          </div>
          <div className="send__network-fee">
            <div className="send__label">
              <span>{t('sendFeeLabel')}</span>
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
          </div>
        </div>
        <div className="send__actions">
          <button
            className="send__cta-btn"
            key="continue"
            onClick={this.onClickContinue}
            disabled={!isValid}
          >
            {t('next')}
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
      hip2Domain,
      isSending,
      feeAmount,
      txSize,
    } = this.state;

    const {t} = this.context;

    return (
      <div className="send__container">
        <div className="send__content">
          <div className="send__header">
            <div className="send__title">{t('sendConfirmTitle')}</div>
          </div>
          <Alert type="error" message={this.state.errorMessage} />
          <div className="send__confirm__to">
            <div className="send__confirm__label">{t('sendToLabel')}</div>
            <div className="send__confirm__address">
              {(hip2Domain && to) ? (
                <span>
                  <span className="send__confirm__secure">
                    <img src={LockSVG} />
                    <a href={`https://${hip2Domain}`} onClick={this.openLinkHandler}>
                      {hip2Domain}
                    </a>
                  </span>
                  ({to})
                </span>
              ) : to}
            </div>
          </div>
          <div className="send__confirm__from">
            <div className="send__confirm__label">{t('sendFromLabel')}</div>
            <div className="send__confirm__time-text">{t('sendDefaultAccountLabel')}</div>
          </div>
          <div className="send__confirm__time">
            <div className="send__confirm__label">{t('sendTxTimeLabel')}</div>
            <div className="send__confirm__time-text">
              {this.renderConfirmTime()}
            </div>
          </div>
          <div className="send__confirm__summary">
            <div className="send__confirm__summary-amount">
              <div className="send__confirm__summary-label">
                {t('sendAmountLabel')}
              </div>
              <div className="send__confirm__summary-value">
                {`${this.addDecimalsToInteger(amount)} HNS`}
              </div>
            </div>
            <div className="send__confirm__summary-fee">
              <div className="send__confirm__summary-label">{t('sendFeeLabel')}:</div>
              <div className="send__confirm__summary-value">{gasFee} HNS/kB</div>
            </div>
            <div className="send__confirm__summary-fee">
              <div className="send__confirm__summary-label">{t('sendTxSizeLabel')}</div>
              <div className="send__confirm__summary-value">{txSize} kB</div>
            </div>
            <div className="send__confirm__summary-fee">
              <div className="send__confirm__summary-label">{t('sendEstimatedFeeLabel')}</div>
              <div className="send__confirm__summary-value">{feeAmount}</div>
            </div>
            <div className="send__confirm__summary-total">
              <div className="send__confirm__summary-label">{t('sendTotalLabel')}</div>
              <div className="send__confirm__summary-value">
                {`${bn(amount).plus(feeAmount).toFixed(6)} HNS`}
              </div>
            </div>
          </div>
        </div>
        <div className="send__confirm__actions">
          <button
            className="send__confirm__cancel-btn"
            onClick={() => this.setState({isConfirming: false})}
            disabled={isSending}
          >
            {t('cancel')}
          </button>
          <button
            key="confirm"
            className="send__confirm__cta-btn"
            onClick={this.send}
            disabled={isSending}
          >
            {isSending ? <div className="send__confirm__spinner" /> : t('submit')}
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
    const {t} = this.context;
    return (
      <div className="send__container">
        <div className="send__sent__wrapper">
          <div className="send__sent__confirm-icon" />
          <div className="send__sent__headline">{t('sendTxSentTitle')}</div>
          <div className="send__sent__description">
            {t('sendTxSentDesc', this.addDecimalsToInteger(amount))}
          </div>
          <div className="send__sent__details send__sent__details-first" onClick={this.viewOnExplorer}>
            {t('viewOnExplorer')}
          </div>
          <div className="send__sent__details" onClick={() => this.resetState()}>
            {t('createNewTransaction')}
          </div>
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
    return this.context.t('sendTxConfirmTime');
  }
}

export default SendModal;
