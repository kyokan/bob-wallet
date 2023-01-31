import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import './transfer-details.scss';
import * as names from '../../ducks/names';
import { showError, showSuccess } from '../../ducks/notifications';
import { clientStub as aClientStub } from '../../background/analytics/client';
import * as networks from 'hsd/lib/protocol/networks';
import AddressInput from '../../components/AddressInput';
import Checkbox from '../../components/Checkbox';
import FinalizeWithPaymentModal from './FinalizeWithPaymentModal';
import {I18nContext} from "../../utils/i18n";

const analytics = aClientStub(() => require('electron').ipcRenderer);

class TransferDetails extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    domain: PropTypes.object,
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);

    this.state = {
      recipient: '',
      acceptances: [false, false, false],
    };
  }

  toggleCheck(i) {
    return () => {
      const acceptances = this.state.acceptances;
      acceptances[i] = !acceptances[i];

      this.setState({
        acceptances,
      });
    };
  }

  checkDisabled = () => {
    return (
      !this.state.acceptances[0] ||
      !this.state.acceptances[1] ||
      !this.state.acceptances[2]
    );
  };

  sendTransfer = async () => {
    try {
      const res = await this.props.sendTransfer(this.state.recipient);
      if (res !== null) {
        this.props.showSuccess(this.context.t('transferSuccess'));
        analytics.track('transferred domain');
      }
    } catch (e) {
      this.props.showError(e.message);
    }
  };

  cancelTransfer = async () => {
    try {
      const res = await this.props.cancelTransfer();
      if (res !== null) {
        this.props.showSuccess(this.context.t('cancelSuccess'));
        analytics.track('cancelled transfer');
      }
    } catch (e) {
      this.props.showError(e.message);
    }
  };

  revokeName = async () => {
    try {
      const res = await this.props.revokeName();
      if (res !== null) {
        this.props.showSuccess(this.context.t('revokeSuccess'));
        analytics.track('revoked name');
      }
    } catch (e) {
      this.props.showError(e.message);
    }
  };

  finalizeTransfer = async () => {
    try {
      const res = await this.props.finalizeTransfer();
      if (res !== null) {
        this.props.showSuccess(this.context.t('finalizeSuccess'));
        analytics.track('finalized transfer');
      }
    } catch (e) {
      this.props.showError(e.message);
    }
  };

  finalizeWithPayment = () => {
    this.setState({
      isShowingFinalizeWithPayment: true,
    });
  };

  render() {
    const domain = this.props.domain || {};
    const {t} = this.context;
    const {info} = domain;

    if (!info) {
      return (
        <div className="transfer-details">
          {t('loading')}
        </div>
      );
    }

    if (!info.registered) {
      return (
        <div className="transfer-details">
          <p>
            {t('transferAfterRegisterWarning')}
          </p>
        </div>
      );
    }

    if (domain.pendingOperation === 'TRANSFER') {
      return (
        <div className="transfer-details">
          <p>
            {t('transferInProgressWarning')}
          </p>
        </div>
      );
    }

    if (info.transfer) {
      const remainingBlocks = (info.transfer + networks[this.props.network].names.transferLockup) - this.props.height;

      if (remainingBlocks <= 0) {
        return (
          <div className="transfer-details">
            <p>
              {t('finalizeTransferWarning')}
            </p>
            <p>
              <button className="extension_cta_button transfer-details__danger" onClick={this.cancelTransfer}>
                {t('cancel')}
              </button>
              <button className="extension_cta_button" onClick={this.finalizeTransfer}>
                {t('finalize')}
              </button>
              <button className="extension_cta_button" onClick={this.finalizeWithPayment}>
                {t('finalizeWithPayment')}
              </button>
            </p>
            {this.state.isShowingFinalizeWithPayment && (
              <FinalizeWithPaymentModal
                onClose={() => this.setState({
                  isShowingFinalizeWithPayment: false,
                })}
                name={this.props.name}
                transferTo={info.transferTo}
              />
            )}
            {this.renderRevoke()}
          </div>
        );
      }

      return (
        <div className="transfer-details">
          <p>
            {t('transferInProgressWarningWithBlocks', remainingBlocks)}
          </p>
          <p>
            <button className="extension_cta_button transfer-details__danger" onClick={this.cancelTransfer}>
              {t('cancel')}
            </button>
          </p>
          {this.renderRevoke()}
        </div>
      );
    }

    return (
      <div className="transfer-details">
        <div className="transfer-details__form">
          <div className="transfer-details__inputs">
            <AddressInput
              onAddress={({address}) => this.setState({
                recipient: address,
              })}
            />
          </div>
          <div className="transfer-details__cta">
            <button
              className="extension_cta_button"
              disabled={!this.state.recipient}
              onClick={this.sendTransfer}
            >
              {this.context.t('transfer')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderRevoke() {
    const {t} = this.context;
    return (
      <>
        <p>
          <strong>{t('revokeWarningLabel')}</strong>
          {t('revokeWarning')}
        </p>
        <p>
          {t('revokeAckTitle')}
        </p>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(0)}
            checked={this.state.acceptances[0]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            {t('revokeAck1')}
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(1)}
            checked={this.state.acceptances[1]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            {t('revokeAck2')}
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(2)}
            checked={this.state.acceptances[2]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            {t('revokeAck3')}
          </div>
        </div>
        <p>
          <button
            className="extension_cta_button"
            onClick={this.revokeName}
            disabled={this.checkDisabled()}
          >
            {t('revoke')}
          </button>
        </p>
      </>
    );
  }
}

export default connect(
  (state, ownProps) => ({
    domain: state.names[ownProps.name],
    height: state.node.chain.height,
    network: state.wallet.network,
    wid: state.wallet.wid,
  }),
  (dispatch, ownProps) => ({
    sendTransfer: (recipient) => dispatch(names.sendTransfer(ownProps.name, recipient)),
    cancelTransfer: () => dispatch(names.cancelTransfer(ownProps.name)),
    finalizeTransfer: () => dispatch(names.finalizeTransfer(ownProps.name)),
    revokeName: () => dispatch(names.revokeName(ownProps.name)),
    showSuccess: (message) => dispatch(showSuccess(message)),
    showError: (message) => dispatch(showError(message)),
  }),
)(TransferDetails);
