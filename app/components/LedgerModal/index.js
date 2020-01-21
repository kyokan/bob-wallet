import React, { Component } from 'react';
import { connect } from 'react-redux';
import Modal from '../Modal';
import { cancelLedger } from '../../ducks/ledgerManager';
import * as logger from '../../utils/logClient';
import './ledger-modal.scss';
import DefaultConnectLedgerSteps from '../ConnectLedgerStep/defaultSteps';
import ConnectLedgerStep from '../ConnectLedgerStep';

@connect(
  (state) => ({
    isShowingLedgerModal: state.ledger.isShowingLedgerModal,
    txId: state.ledger.txId,
    connect: state.ledger.cb,
  })
)
export class LedgerModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      errorMessage: '',
      isDone: false,
      isLoading: false
    };
  }

  onClickConnect = async () => {
    try {
      this.setState({
        isLoading: true
      });

      // the result will be a boolean. errors are trapped by the
      // handler in awaitLedger.
      const res = await this.props.connect();
      if (res !== true) {
        this.handleError(res)
      }
    } catch (err) {
      this.handleError(err)
    } finally {
      this.setState({
        isLoading: false
      });
    }
  };

  handleError(err) {
    logger.error('failed to connect to ledger', {err});
    this.setState({
      errorMessage: `Couldn't connect to your Ledger. Please try again.`
    });
  }

  render() {
    if (!this.props.isShowingLedgerModal) {
      return false;
    }

    return (
      <Modal className="ledger-modal__wrapper" onClose={cancelLedger}>
        <div className="ledger-modal">
          {this.renderError()}
          <DefaultConnectLedgerSteps completedSteps={[false, false, false]} />
          <div className="ledger-modal__last-step">
            <ConnectLedgerStep
              stepNumber={4}
              stepDescription="Match the ID displayed on your Ledger to the one below."
              stepCompleted={false}
            />
          </div>
          <div className="ledger-modal__hash">
            {this.props.txId}
          </div>
          <div className="ledger-modal__cta-wrapper">
            <button
              className="ledger-modal__cancel"
              onClick={cancelLedger}
              disabled={this.state.isLoading}
            >
              Cancel
            </button>
            <button
              className="ledger-modal__connect" onClick={this.onClickConnect}
              disabled={this.state.isLoading}
            >
              {this.state.isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      </Modal>
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
