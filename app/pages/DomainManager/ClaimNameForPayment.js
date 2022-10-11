import fs from 'fs';
import { Amount } from 'hsd/lib/ui';
import React, { Component } from 'react';
import { MiniModal } from '../../components/Modal/MiniModal';
import { MTX } from 'hsd/lib/primitives';
import { connect } from 'react-redux';
import { showSuccess } from '../../ducks/notifications';
import { claimPaidTransfer } from '../../ducks/names';
import { waitForPassphrase, hasAddress } from '../../ducks/walletActions';
import {I18nContext} from "../../utils/i18n";
import { parseTxFile } from '../../utils/parsers';

const { dialog } = require('@electron/remote');


@connect(
  (state) => ({
    network: state.wallet.network,
  }),
  (dispatch) => ({
    showSuccess: (message) => dispatch(showSuccess(message)),
    claimPaidTransfer: (hex) => dispatch(claimPaidTransfer(hex)),
    waitForPassphrase: () => dispatch(waitForPassphrase()),
    hasAddress: (address) => dispatch(hasAddress(address)),
  }),
)
export default class ClaimNameForPayment extends Component {
  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = {
      step: 0,
      hex: '',
      isConfirming: false,
    };
  }

  onSelectFile = async (e) => {
    const { t } = this.context;
    const {
      filePaths: [filepath],
    } = await dialog.showOpenDialog({
      title: t('openTxFile'),
      properties: ['openFile'],
      filters: [
        {
          name: t('transactionFile'),
          extensions: ['json'],
        },
      ],
    });

    if (!filepath) return;

    try {
      const fileContent = fs.readFileSync(filepath, 'utf-8');
      const {txHex} = parseTxFile(fileContent);

      if (!txHex || typeof txHex !== 'string') {
        throw new Error('Invalid transaction file.');
      }

      this.setState({hex: txHex});
      this.onClickVerify(txHex);
    } catch (error) {
      this.setState({hexError: error?.message || 'Error.'})
    }
  }

  onClickVerify = async (hex) => {
    const { t } = this.context;

    try {
      const {network, hasAddress} = this.props;
      const mtx = MTX.decode(Buffer.from(hex || this.state.hex, 'hex'));
      const firstOutput = mtx.outputs[0];
      const nameReceiveAddr = firstOutput.address.toString(network);
      const name = firstOutput.covenant.items[2].toString('ascii');
      const secondOutput = mtx.outputs[1];
      const fundingAddr = secondOutput.address.toString(network);
      const price = secondOutput.value;
      const isOwn = await hasAddress(nameReceiveAddr);

      if (!isOwn && !this.state.isConfirming) {
        this.setState({
          isConfirming: true,
          hexError: t('claimNamePaymentNotOwnedError'),
        });
      } else {
        this.setState({
          step: 1,
          name,
          nameReceiveAddr,
          fundingAddr,
          price,
        });
      }
    } catch (e) {
      console.error(e);
      this.setState({
        hexError: t('claimNamePaymentInvalidHexError'),
      });
    }
  };

  onClickTransfer = async () => {
    const { t } = this.context;
    try {
      this.setState({
        isLoading: true,
      });
      const mtx = await this.props.claimPaidTransfer(this.state.hex);
      if (mtx) {
        this.props.showSuccess(t('claimNamePaymentSuccess'));
      }
      this.props.onClose();
    } catch (e) {
      this.setState({
        transferError: e.message,
        isLoading: false,
      });
    }
  };

  render() {
    return (
      <MiniModal title={this.context.t('claimNamePaymentTitle')} onClose={this.props.onClose}>
        {this.renderSteps()}
      </MiniModal>
    );
  }

  renderSteps() {
    switch (this.state.step) {
      case 0:
        return this.renderEnterHex();
      case 1:
        return this.renderVerify();
    }
  }

  renderEnterHex() {
    const { t } = this.context;
    return (
      <>
        <p>
          { t('claimNamePaymentBody') }
        </p>

        {this.state.hexError && (
          <p className="claim-name-for-payment-invalid">
            {this.state.hexError}
          </p>
        )}

        <div className="import-enter__textarea-container">
            <textarea
              className="import_enter_textarea"
              placeholder={t('claimNamePaymentHexPlaceholder')}
              value={this.state.hex}
              onChange={(e) => this.setState({
                hex: e.target.value,
              })}
              rows={8}
            />
        </div>

        <div className="claim-name-for-payment__file">
          <p>or</p>
          <button onClick={this.onSelectFile}>
            {t('claimNamePaymentSelectFile')}
          </button>
        </div>

        <div className="send__actions">
          <button
            className="send__cta-btn"
            onClick={() => this.onClickVerify()}
            disabled={!this.state.hex.length}
          >
            {t('verify')}
          </button>
        </div>
      </>
    );
  }

  renderVerify() {
    const { t } = this.context;
    return (
      <>
        <p>
          { t('claimNamePaymentVerifyBody') }
        </p>

        {this.state.transferError && (
          <p className="claim-name-for-payment-invalid">
            {this.state.transferError}
          </p>
        )}

        <dl className="claim-name-for-payment-verification">
          <dt>{t('domain')}</dt>
          <dd>{this.state.name}</dd>
          <dt>{t('addressReceivingName')}</dt>
          <dd>{this.state.nameReceiveAddr}</dd>
          <dt>{t('addressReceivingFunds')}</dt>
          <dd>{this.state.fundingAddr}</dd>
          <dt>{t('price')}</dt>
          <dd>{Amount.fromValue(this.state.price).toCoins()} HNS</dd>
        </dl>

        <div className="claim-name-for-payment__verification-buttons">
          <button
            className="abort"
            onClick={this.props.onClose}
          >
            {t('abort')}
          </button>
          <button
            className="pay-and-transfer"
            onClick={this.onClickTransfer}
            disabled={this.state.isLoading}
          >
            {this.state.isLoading ? t('creating') : t('payAndTransfer')}
          </button>
        </div>
      </>
    );
  }
}
