import React, { Component } from 'react';
import { connect } from 'react-redux';
import SideModal from '../Modal/SideModal';
import * as logger from '../../utils/logClient';
import './ledger-modal.scss';
import DefaultConnectLedgerSteps from '../ConnectLedgerStep/defaultSteps';
import ConnectLedgerStep from '../ConnectLedgerStep';
import {I18nContext} from "../../utils/i18n";

const ipc = require('electron').ipcRenderer;

@connect(
  (state) => ({
    network: state.wallet.network,
    isLocked: state.wallet.isLocked,
  }),
)
export class LedgerModal extends Component {
  static contextType = I18nContext;

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
      errorMessage: '',
    });
  };

  handleError(err) {
    const {t} = this.context;
    logger.error('failed to connect to ledger', {err});

    // Totally confusing
    if (err === 'Device was not selected.')
      err = t('ledgerModalNoConnError');

    this.setState({
      errorMessage: t('ledgerModalGenericError', err),
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
    const {t} = this.context;

    if (!this.state.isVisible) {
      return <></>;
    }

    return (
      <SideModal className="ledger-modal__wrapper" onClose={this.cancelLedger}>
        <div className="ledger-modal">
          {this.renderError()}
          <DefaultConnectLedgerSteps completedSteps={[false, false, false]} />
          <div className="ledger-modal__last-step">
            <ConnectLedgerStep
              stepNumber={4}
              stepDescription={t('ledgerModalConfirmText')}
              stepCompleted={false}
            />
          </div>
          <div className="ledger-modal__cta-wrapper">
            <button
              className="ledger-modal__connect" onClick={this.onClickConnect}
              disabled={this.state.isLoading}
            >
              {this.state.isLoading ? t('obLedgerConnecting') : t('obLedgerConnectLedger')}
            </button>
            <button
              className="ledger-modal__cancel"
              onClick={this.cancelLedger}
              disabled={this.state.isLoading}
            >
              {t('cancel')}
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
