import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {QRCodeSVG} from 'qrcode.react';
import copy from 'copy-to-clipboard';
import './receive.scss';
import CopyButton from '../CopyButton';
import { clientStub as aClientStub } from '../../background/analytics/client';
import {I18nContext} from "../../utils/i18n";

const analytics = aClientStub(() => require('electron').ipcRenderer);

@connect(state => ({
  address: state.wallet.receiveAddress,
}))
export default class ReceiveModal extends Component {
  static propTypes = {
    address: PropTypes.string.isRequired,
  };

  static contextType = I18nContext;

  state = {
    isShowingAddress: false,
    hasCopied: false,
  };

  componentDidMount() {
    analytics.screenView('Receive');
  }

  copyAddress = () => {
    copy(this.props.address);
    this.setState({hasCopied: true});
    setTimeout(() => this.setState({hasCopied: false}), 2500);
  };

  renderContent() {
    const {isShowingAddress, hasCopied} = this.state;
    const {t} = this.context;
    const {address} = this.props;

    return isShowingAddress ? (
      <div className="receive__content">
        <div className="receive__header">
          <div className="receive__title">{t('receiveModalYourAddressLabel')}</div>
        </div>
        <div className="receive__address-display">
          <div className="receive__address">{address}</div>
          <CopyButton content={address} />
        </div>
        <div className="receive__qr-code">
          <QRCodeSVG value={address} />
        </div>
        <div className="receive__disclaimer">
          {t('receiveModalQRDisclaimer')}
        </div>
      </div>
    ) : (
      <div className="receive__content">
        <div className="receive__warning-icon" />
        <div className="receive__warning-title">
          {t('receiveModalWarning')}
        </div>
        <div className="receive__warning-subtitle">
          {t('receiveModalWarning2')}
        </div>
        <button
          className="receive__show-address-btn"
          onClick={() => this.setState({isShowingAddress: true})}
        >
          {t('receiveModalShowAddress')}
        </button>
      </div>
    );
  }

  render() {
    return <div className="receive__container">{this.renderContent()}</div>;
  }
}
