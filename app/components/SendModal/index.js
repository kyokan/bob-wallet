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
import {I18nContext} from "../../utils/i18n";
import LockSVG from '../../assets/images/lock.svg';
import RingsSVG from '../../assets/images/rings.svg';
import hip2 from "../../utils/hip2Client";

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
    hip2Port: state.hip2.port,
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
      hip2Input: false,
      hip2To: '',
      hip2Error: '',
      hip2Loading: false,
      hip2Disabled: false,
      amount: '',
      errorMessage: '',
      addressError: false,
      feeAmount: 0,
      txSize: 0,
    };

    hip2.setServers([`127.0.0.1:${props.hip2Port}`]);
  }

  openLinkHandler (e) {
    e.preventDefault()
    shell.openExternal(e.target.href)
  }

  updateToAddress = async e => {
    const hip2Enabled = !this.props.noDns && this.props.isSynchronized // && !this.state.simulateSynchronizing
    let input = e.target.value
    let justEnabled = false

    if (hip2Enabled) {
      if (!this.state.hip2Input && input[0] === '@') {
        justEnabled = true

        // handle alias copy/pastes
        input = input.slice(1)
        this.setState({ hip2Input: true, hip2To: input, to: '', errorMessage: '', hip2Error: '', hip2Loading: false })
      }

      if (this.state.hip2Input || justEnabled) {
        // prevent latency attacks: clear `to` address on new input
        this.setState({ hip2To: input, hip2Error: '', to: '' })

        if (input) {
          this.setState({ hip2Loading: true })

          // delay lookup by 120ms
          setTimeout(() => {
            // abort lookup if input has changed
            if (!(this.state.hip2Input && this.state.hip2To === input)) return

            hip2.fetchAddress(input).then(to => {
              // prevent latency attacks: only set `to` address if matches the current input
              if (this.state.hip2Input && this.state.hip2To === input) {
                this.setState({ to, errorMessage: '', hip2Error: '', hip2Loading: false })
              }
            }).catch(err => {
              if (this.state.hip2Input && this.state.hip2To === input) {
                let hip2Error
                if (err.code === 'EINVALID') {
                  hip2Error = this.context.t('hip2InvalidAddress')
                } else if (err.code === 'ELARGE') {
                  hip2Error = this.context.t('hip2InvalidAddress')
                } else if (err.code === 'ECOLLISION') {
                  hip2Error = this.context.t('hip2InvalidAlias')
                } else if (err.code === 'EINSECURE') {
                  hip2Error = this.context.t('hip2InvalidTLSA')
                } else {
                  hip2Error = this.context.t('hip2AddressNotFound')
                }
                this.setState({ to: '', errorMessage: '', hip2Error, hip2Loading: false })
              }
            })
          }, 120)
        }
      } else {
        this.setState({ to: input, errorMessage: '', hip2Error: '', hip2Loading: false });
      }
    } else {
      this.setState({ to: input, errorMessage: '', hip2Error: '', hip2Loading: false });
    }

    if (!justEnabled && !this.state.hip2Input && input.length > 2 && !isValidAddress(input, this.props.network)) {
      this.setState({ errorMessage: this.context.t('invalidAddress') });
    }
  };

  updateHip2 = e => {
    if (this.state.hip2Input) {
      if (e.key === 'Backspace' && this.state.hip2To.length === 0) {
        this.resetInput()
      }
    }
  }

  resetInput = () => {
    this.setState({ hip2Input: false, hip2To: '', hip2Error: '', to: '', errorMessage: '', hip2Loading: false })
  }

  handleEscape = e => {
    if (this.state.hip2Input && e.key === 'Escape') {
      this.resetInput()
    }

    // if (e.metaKey && e.key === 's') {
    //   this.setState({ simulateSynchronizing: !this.state.simulateSynchronizing }) // toggle sync simulation
    // }
  }

  componentDidMount = () => {
    document.addEventListener('keydown', this.handleEscape)
    analytics.screenView('Send');
  }

  componentWillUnmount = () => {
    document.removeEventListener('keydown', this.handleEscape)
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
    const {selectedGasOption, amount, to, hip2Input, hip2To, hip2Error, hip2Loading} = this.state;
    const {t} = this.context;
    const {isValid} = this.validate();

    const hip2Enabled = !this.props.noDns && this.props.isSynchronized // && !this.state.simulateSynchronizing
    const hip2Disabled = !hip2Enabled && hip2Input; // waiting for node to synchronize
    const hip2DisabledWarning = hip2Disabled ? t('hip2DisabledWarning') : '';

    // clear hip2 lookup address and error
    if (hip2Disabled && (this.state.to || this.state.hip2Error)) {
      this.setState({ to: '', hip2Error: '', hip2Disabled: true })

    // lookup again once synchronized
    } else if (hip2Enabled && this.state.hip2Disabled) {
      this.setState({ hip2Disabled: false })
      this.updateToAddress({ target: { value: this.state.hip2To } })
    }

    return (
      <div className="send__container">
        <div className="send__content">
          <div className="send__header">
            <div className="send__title">{t('sendTitle')}</div>
          </div>
          <Alert type="error" message={this.state.errorMessage} />
          <Alert type="warning" message={hip2DisabledWarning} />
          <div className="send__to">
            <div className="send__label">{t('sendToLabel')}</div>
            <div className="send__input" key="send-input">
              {hip2Input &&
              <span className="send__prefix">{to ? (
                <img src={LockSVG} />
              ) : ( hip2Loading ?
                <img className="send__hip2-loading" src={RingsSVG} />
                : '@')}
              </span>}
              <input
                type="text"
                placeholder={hip2Input ?
                  t('recipientHip2Address') :
                  (hip2Enabled ?
                    t('recipientAddressHip2Enabled') :
                    (!this.props.noDns ?
                      t('recipientAddressHip2Syncing') :
                      t('recipientAddress')
                    )
                  )
                }
                onChange={this.updateToAddress}
                onKeyDown={this.updateHip2}
                spellCheck="false"
                disabled={hip2Disabled}
                value={hip2Input ? hip2To : to}
              />
            </div>
            { hip2Input && (
              <React.Fragment>
                <Alert type="error" message={hip2Error} />
                <Alert type="info" message={to && `↪ ${to}`} />
              </React.Fragment>
            ) }
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
      isSending,
      feeAmount,
      txSize,
      hip2Input,
      hip2To
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
              {(hip2Input && to) ? (
                <span>
                  <span className="send__confirm__secure"><img src={LockSVG} /> <a href={`https://${hip2To}`} onClick={this.openLinkHandler}>{hip2To}</a></span>
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
