import React, { Component } from 'react';
import { MiniModal } from '../../components/Modal/MiniModal';
import { MTX } from 'hsd/lib/primitives';
import { connect } from 'react-redux';
import { clientStub as nClientStub } from '../../background/node/client';
import { showSuccess } from '../../ducks/notifications';

const node = nClientStub(() => require('electron').ipcRenderer);

@connect(
  (state) => ({
    network: state.node.network,
  }),
  (dispatch) => ({
    showSuccess: (message) => dispatch(showSuccess(message)),
  }),
)
export default class ClaimNameForPayment extends Component {
  constructor(props) {
    super(props);
    this.state = {
      step: 0,
      hex: '',
    };
  }

  onClickVerify = () => {
    try {
      const {network} = this.props;
      const mtx = MTX.decode(Buffer.from(this.state.hex, 'hex'));
      const firstOutput = mtx.outputs[0];
      const nameReceiveAddr = firstOutput.address.toString(network);
      const name = firstOutput.covenant.items[2].toString('ascii');
      const secondOutput = mtx.outputs[1];
      const fundingAddr = secondOutput.address.toString(network);
      const price = secondOutput.value;

      this.setState({
        step: 1,
        name,
        nameReceiveAddr,
        fundingAddr,
        price,
      });
    } catch (e) {
      this.setState({
        hexError: 'Invalid hex value.',
      });
    }
  };

  onClickTransfer = async () => {
    try {
      await node.claimPaidTransfer(this.state.hex);
      this.props.onClose();
      this.props.showSuccess('Successfully claimed paid transfer. Please wait 1 block for the name to appear.');
    } catch (e) {
      this.setState({
        transferError: e.message,
      });
    }
  };

  render() {
    return (
      <MiniModal title="Claim Name For Payment" onClose={this.props.onClose}>
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
    return (
      <>
        <p>
          If your counterparty has sent you a name transfer for payment,
          paste the hex string into the box below to verify it and claim
          your name.
        </p>

        {this.state.hexError && (
          <p className="claim-name-for-payment-invalid">
            {this.state.hexError}
          </p>
        )}

        <div className="import-enter__textarea-container">
            <textarea
              className="import_enter_textarea"
              value={this.state.hex}
              onChange={(e) => this.setState({
                hex: e.target.value,
              })}
              rows={8}
            />
        </div>

        <div className="send__actions">
          <button
            className="send__cta-btn"
            onClick={this.onClickVerify}
            disabled={!this.state.hex.length}
          >
            Verify
          </button>
        </div>
      </>
    );
  }

  renderVerify() {
    return (
      <>
        <p>
          Please verify all the information below. If anything looks invalid,
          please close this window.
        </p>

        {this.state.transferError && (
          <p className="claim-name-for-payment-invalid">
            {this.state.transferError}
          </p>
        )}

        <dl className="claim-name-for-payment-verification">
          <dt>Name</dt>
          <dd>{this.state.name}</dd>
          <dt>Address Receiving Name</dt>
          <dd>{this.state.nameReceiveAddr}</dd>
          <dt>Address Receiving Funds</dt>
          <dd>{this.state.fundingAddr}</dd>
          <dt>Price</dt>
          <dd>{this.state.price} HNS</dd>
        </dl>

        <div className="claim-name-for-payment__verification-buttons">
          <button
            className="abort"
            onClick={this.props.onClose}
          >
            Abort
          </button>
          <button
            className="pay-and-transfer"
            onClick={this.onClickTransfer}
          >
            Pay and Transfer
          </button>
        </div>
      </>
    );
  }
}
