import React, { Component } from 'react';
import { MiniModal } from '../../components/Modal/MiniModal';
import { clientStub as nClientStub } from '../../background/node/client';
import { clientStub as wClientStub } from '../../background/wallet/client';

const node = nClientStub(() => require('electron').ipcRenderer);
const wallet = wClientStub(() => require('electron').ipcRenderer);

export default class FinalizeWithPaymentModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      error: '',
      recipient: '',
      price: '',
      hex: '',
    };
  }

  onClickFinalize = async () => {
    try {
      const fundingAddr = (await wallet.generateReceivingAddress()).address;
      const hex = await node.finalizeWithPayment(
        this.props.name,
        fundingAddr,
        this.state.recipient,
        Number(this.state.price),
      );
      this.setState({
        hex,
      });
    } catch (e) {
      this.setState({
        error: e.message || e,
      });
    }
  };

  render() {
    const { hex } = this.state;

    return (
      <MiniModal title="Finalize With Payment" onClose={this.props.onClose}>
        {hex && this.renderInstructions()}
        {!hex && this.renderForm()}
      </MiniModal>
    );
  }

  renderInstructions() {
    return (
      <>
        <p>Send the hex string below to your counterparty.</p>

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
            Done
          </button>
        </div>
      </>
    );
  }

  renderForm() {
    const isValid = !!this.state.recipient && !!this.state.price && (
      !!this.state.price && Number(this.state.price) <= 2000
    );

    return (
      <>
        <p>
          To require payment to finalize this transfer, please
          fill out the steps below.
        </p>

        <p>
          <strong>
            As a precaution, transfers are limited to 2000 HNS
            until this feature has been sufficiently tested.
          </strong>
        </p>

        <div className="send__to">
          <div className="send__input">
            <input
              type="text"
              value={this.state.recipient}
              onChange={(e) => this.setState({
                recipient: e.target.value,
              })}
              placeholder="Enter a recipient for the name..."
            />
          </div>
        </div>
        <div className="send__to">
          <div className="send__input">
            <input
              type="number"
              min={0}
              placeholder="0.000000"
              onChange={(e) => this.setState({
                price: e.target.value,
              })}
              value={this.state.price}
            />
          </div>
        </div>
        <div className="send__actions">
          <button
            className="send__cta-btn"
            onClick={this.onClickFinalize}
            disabled={!isValid}
          >
            Finalize
          </button>
        </div>
      </>
    );
  }
}
