import React, { Component } from 'react';
import { connect } from 'react-redux';
import { MiniModal } from '../../components/Modal/MiniModal.js';
import { submitToShakedex } from '../../ducks/exchange.js';
import { clientStub as sClientStub } from '../../background/shakedex/client.js';
import { getPassphrase } from '../../ducks/walletActions.js';

const shakedex = sClientStub(() => require('electron').ipcRenderer);

export class ConfirmFeeModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isListing: false,
    };
  }

  uploadListing = async () => {
    this.setState({
      isListing: true,
    });
    const {listing, feeInfo} = this.props;
    const overrideParams = {
      ...listing.params,
      feeRate: feeInfo.rate,
      feeAddr: feeInfo.addr,
    };
    const passphrase = await new Promise((resolve, reject) => this.props.getPassphrase(resolve, reject));
    const regeneratedAuction = await shakedex.launchAuction(listing.nameLock, passphrase, overrideParams, false);
    this.props.onClose();
    await this.props.submitToShakedex(regeneratedAuction);

  };

  render() {
    const {onClose, feeInfo} = this.props;

    return (
      <MiniModal title="Confirm Fee" onClose={onClose}>
        <p>
          The auction provider charges a fee of {feeInfo.rate / 100}%. Do you still want to post
          your auctions?
        </p>

        <p>
          <strong>Note:</strong> Your auction presigns will be regenerated prior to upload. However,
          the presigns stored locally will remain without a fee.
        </p>

        <div className="place-bid-modal__buttons">
          <button
            className="place-bid-modal__cancel"
            onClick={onClose}
            disabled={this.props.isListing}
          >
            Cancel
          </button>

          <button
            className="place-bid-modal__send"
            onClick={this.uploadListing}
            disabled={this.props.isListing}
          >
            {this.props.isListing ? 'Loading...' : 'Submit'}
          </button>
        </div>
      </MiniModal>
    );
  }
}

export default connect(
  () => ({}),
  (dispatch) => ({
    getPassphrase: (resolve, reject) => dispatch(getPassphrase(resolve, reject)),
    submitToShakedex: (auction) => dispatch(submitToShakedex(auction)),
  }),
)(
  ConfirmFeeModal,
);
