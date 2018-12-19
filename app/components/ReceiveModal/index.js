import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import QRCode from 'qrcode.react';
import copy from 'copy-to-clipboard';
import c from 'classnames';
import Modal from '../Modal';
import './receive.scss';

@connect(
  state => ({
    address: state.wallet.address,
  }),
)
export default class ReceiveModal extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    address: PropTypes.string.isRequired,
  };

  static defaultProps = {
    address: '3P3QsMVK89JBNqZQv5zMAKG8FK3kJM4rjt',
  };

  state = {
    isShowingAddress: false,
    hasCopied: false,
  };

  copyAddress = () => {
    copy(this.props.address);
    this.setState({ hasCopied: true });
    setTimeout(() => this.setState({ hasCopied: false }), 2500);
  };

  renderContent() {
    const { isShowingAddress, hasCopied } = this.state;
    const { address } = this.props;

    return isShowingAddress
      ? (
        <div className="receive__content">
          <div className="receive__qr-code">
            <QRCode value={address} />
          </div>
          <div className="receive__address-display">
            <div className="receive__address">{address}</div>
            <button
              className={c('receive__copy-btn', {
                'receive__copy-btn--copied': hasCopied,
              })}
              onClick={this.copyAddress}
            >
              Copy
            </button>
          </div>
        </div>
      )
      : (
        <div className="receive__content">
          <div className="receive__warning-title">Only receive HNS from this address</div>
          <div className="receive__warning-subtitle">
            Sending coins other than HNS will result in permanent loss. There is no way to recover those funds.
          </div>
        </div>
      );
  }

  render() {
    const { onClose } = this.props;

    return (
      <Modal className="receive" onClose={onClose}>
        <div className="receive__container">
          <div className="receive__header">
            <div className="receive__title">Receive funds</div>
            <div className="receive__close-btn" onClick={onClose}>✕</div>
          </div>
          { this.renderContent() }
          {
            !this.state.isShowingAddress
              ? (
                <div>
                  <button
                    className="receive__show-address-btn"
                    onClick={() => this.setState({isShowingAddress: true})}
                  >
                    Show address
                  </button>
                </div>
              )
              : null
          }
        </div>
      </Modal>
    );
  }
}
