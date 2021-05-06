import React, { Component } from 'react';
import { connect } from 'react-redux';
import SideModal from '../Modal/SideModal';
import * as logger from '../../utils/logClient';
import './ledger-modal.scss';
import DefaultConnectLedgerSteps from '../ConnectLedgerStep/defaultSteps';
import ConnectLedgerStep from '../ConnectLedgerStep';

const ipc = require('electron').ipcRenderer;

@connect(
  (state) => ({
    network: state.node.network,
    isLocked: state.wallet.isLocked,
  }),
)
export class LedgerModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      errorMessage: '',
      isDone: false,
      isLoading: false,
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.isLocked) {
      ipc.send('LEDGER/CONNECT_CANCEL');

      return {
        ...state,
        isVisible: false,
        txId: null,
        errorMessage: '',
      }
    }

    return state;
  }

  componentDidMount() {
    ipc.on('LEDGER/CONNECT', this.onLedgerConnectReq);
    ipc.on('LEDGER/CONNECT_ERR', (evt, err) => this.handleError(err));
    ipc.on('LEDGER/CONNECT_OK', () => this.setState({
      isVisible: false,
      txId: null,
      isLoading: false,
      errorMessage: '',
    }));
  }

  onLedgerConnectReq = (evt, txId) => {
    this.setState({
      isVisible: true,
      txId,
    });
  };

  onClickConnect = async () => {
    ipc.send('LEDGER/CONNECT_RES');
    this.setState({
      isLoading: true,
    });
  };

  handleError(err) {
    logger.error('failed to connect to ledger', {err});
    this.setState({
      errorMessage: `Couldn't connect to your Ledger. Please try again.`,
      isLoading: false,
    });
  }

  cancelLedger = () => {
    ipc.send('LEDGER/CONNECT_CANCEL');
    this.setState({
      isVisible: false,
      txId: null,
      errorMessage: '',
    });
  };

  render() {
    if (!this.state.isVisible) {
      return null;
    }

    return (
      <SideModal className="ledger-modal__wrapper" onClose={this.cancelLedger}>
        <div className="ledger-modal">
          {this.renderError()}
          <DefaultConnectLedgerSteps completedSteps={[false, false, false]} />
          <div className="ledger-modal__last-step">
            <ConnectLedgerStep
              stepNumber={4}
              stepDescription="Confirm the transaction info on your ledger device."
              stepCompleted={false}
            />
          </div>
          <div className="ledger-modal__cta-wrapper">
            <button
              className="ledger-modal__connect" onClick={this.onClickConnect}
              disabled={this.state.isLoading}
            >
              {this.state.isLoading ? 'Connecting...' : 'Connect'}
            </button>
            <button
              className="ledger-modal__cancel"
              onClick={this.cancelLedger}
              disabled={this.state.isLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      </SideModal>
    );
  }

  renderError() {
    if (this.state.errorMessage) {
      return (
        <div className="ledger-modal__error">
          {this.state.errorMessage}
        </div>
      );
    }

    return null;
  }
}
