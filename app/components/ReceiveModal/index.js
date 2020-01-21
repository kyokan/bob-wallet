import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import QRCode from 'qrcode.react';
import copy from 'copy-to-clipboard';
import './receive.scss';
import CopyButton from '../CopyButton';
import { clientStub as aClientStub } from '../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

@connect(state => ({
  address: state.wallet.address,
}))
export default class ReceiveModal extends Component {
  static propTypes = {
    address: PropTypes.string.isRequired,
  };

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
    const {address} = this.props;

    return isShowingAddress ? (
      <div className="receive__content">
        <div className="receive__header">
          <div className="receive__title">Your Address:</div>
        </div>
        <div className="receive__address-display">
          <div className="receive__address">{address}</div>
          <CopyButton content={address} />
        </div>
        <div className="receive__qr-code">
          <QRCode value={address} />
        </div>
        {/* <div className="receive__disclaimer">Your Address:</div> */}
        <div className="receive__disclaimer">
          This QR code can be scanned by the person who is sending you HNS
          coins.
        </div>
      </div>
    ) : (
      <div className="receive__content">
        <div className="receive__warning-icon" />
        <div className="receive__warning-title">
          Only receive HNS from this address
        </div>
        <div className="receive__warning-subtitle">
          Sending coins other than HNS will result in permanent loss. There is
          no way to recover those funds.
        </div>
        <button
          className="receive__show-address-btn"
          onClick={() => this.setState({isShowingAddress: true})}
        >
          Show address
        </button>
      </div>
    );
  }

  render() {
    const {onClose} = this.props;

    return <div className="receive__container">{this.renderContent()}</div>;
  }
}
