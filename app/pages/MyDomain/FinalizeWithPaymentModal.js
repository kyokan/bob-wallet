import React, { Component } from 'react';
import { MiniModal } from '../../components/Modal/MiniModal';
import { clientStub as wClientStub } from '../../background/wallet/client';
import { finalizeWithPayment } from '../../ducks/names';
import { connect } from 'react-redux';
import {consensus} from 'hsd/lib/protocol';
import { waitForPassphrase } from '../../ducks/walletActions';
import {I18nContext} from "../../utils/i18n";

const wallet = wClientStub(() => require('electron').ipcRenderer);

export class FinalizeWithPaymentModal extends Component {
  static contextType = I18nContext;

  constructor(props) {
    super(props);

    this.state = {
      error: '',
      price: '',
      hex: '',
    };
  }

  onClickFinalize = async () => {
    try {
      const fundingAddr = (await wallet.generateReceivingAddress()).address;
      const hex = await this.props.finalizeWithPayment(
        this.props.name,
        fundingAddr,
        this.props.transferTo,
        this.state.price,
      );
      if (hex) {
        this.setState({
          hex,
        });
      } else {
        this.props.onClose();
      }
    } catch (e) {
      console.error(e);
      this.setState({
        error: e.message || e,
      });
    }
  };

  render() {
    const {hex} = this.state;

    return (
      <MiniModal title={this.context.t('finalizeWithPayment')} onClose={this.props.onClose}>
        {hex && this.renderInstructions()}
        {!hex && this.renderForm()}
      </MiniModal>
    );
  }

  renderInstructions() {
    const {t} = this.context;

    return (
      <>
        <p>{t('finalizeWithPaymentInstruction')}</p>

        <div className="import-enter__textarea-container">
            <textarea
              className="import_enter_textarea"
              value={this.state.hex}
              disabled={true}
              rows={12}
            />
        </div>

        <div className="send__actions">
          <button
            className="send__cta-btn"
            onClick={this.props.onClose}
          >
            {t('done')}
          </button>
        </div>
      </>
    );
  }

  processValue = (val) => {
    const value = val.match(/[0-9]*\.?[0-9]{0,6}/g)[0];
    if (Number.isNaN(parseFloat(value)))
      return;
    if (value * consensus.COIN > consensus.MAX_MONEY)
      return;
    this.setState({price: value});
  }

  renderForm() {
    const {t} = this.context;
    const isValid = !!this.state.price;

    return (
      <>
        <p>
          {t('finalizeWithPaymentWarning1')}
        </p>

        <div className="send__to">
          <div className="send__input">
            <input
              type="number"
              min={0}
              placeholder="0.000000"
              onChange={(e) => this.processValue(e.target.value)}
              value={this.state.price}
            />
          </div>
        </div>
        <div className="send__to">
          {t('recipientAddress')}:
        </div>
        <div className="send__to">
          {this.props.transferTo}
        </div>
        <div className="send__actions">
          <button
            className="send__cta-btn"
            onClick={this.onClickFinalize}
            disabled={!isValid}
          >
            {t('finalize')}
          </button>
        </div>
      </>
    );
  }
}

export default connect(
  () => ({}),
  (dispatch) => ({
    finalizeWithPayment: (name, fundingAddr, recipient, price) => dispatch(finalizeWithPayment(name, fundingAddr, recipient, price)),
    waitForPassphrase: () => dispatch(waitForPassphrase()),
  }),
)(FinalizeWithPaymentModal);
