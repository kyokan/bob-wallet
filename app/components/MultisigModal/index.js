import fs from 'fs';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from "prop-types";
import Modal from '../Modal';
import TxViewer from '../TxViewer';
import { showError, showSuccess } from "../../ducks/notifications";
import * as walletActions from "../../ducks/walletActions";
import walletClient from "../../utils/walletClient";
import {I18nContext} from "../../utils/i18n";
import './multisig-modal.scss';

const { dialog } = require('@electron/remote');
const ipc = require('electron').ipcRenderer;

@connect(
  (state) => ({
    network: state.wallet.network,
    walletId: state.wallet.wid,
    accountKey: state.wallet.accountKey,
    walletKeys: state.wallet.keys,
    walletKeysNames: state.wallet.keysNames,
  }),
  (dispatch) => ({
    showSuccess: (message) => dispatch(showSuccess(message)),
    showError: (message) => dispatch(showError(message)),
    getPassphrase: (resolve, reject) => dispatch(walletActions.getPassphrase(resolve, reject)),
  })
)
export class MultisigModal extends Component {
  static propTypes = {
    network: PropTypes.string.isRequired,
    walletId: PropTypes.string.isRequired,
    accountKey: PropTypes.string.isRequired,
    walletKeys: PropTypes.array.isRequired,
    walletKeysNames: PropTypes.object.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    getPassphrase: PropTypes.func.isRequired,
  }

  static contextType = I18nContext;

  constructor(props) {
    super(props);

    this.state = {
      errorMessage: '',
      tx: null,
      multisigInfo: [],
      signerData: [],
      metadata: {},
      maxSigsNeeded: null,
      canAddOwnSig: true,
      broadcast: true,
      justSigned: false,      // whether user just signed tx
    };
  }

  componentDidMount() {
    ipc.on('MULTISIG/SHOW', this.onShowTx);
    ipc.on('MULTISIG/ERR', this.handleError);
    ipc.on('MULTISIG/OK', () => this.setState({
      isVisible: false,
      errorMessage: '',
    }));
  }

  onShowTx = (event, data) => {
    const {
      tx,
      multisigInfo,
      signerData,
      metadata,
      maxSigsNeeded,
      canAddOwnSig,
      broadcast,
      justSigned,
    } = data;
    this.setState({
      isVisible: true,
      tx,
      multisigInfo,
      signerData,
      metadata,
      maxSigsNeeded,
      canAddOwnSig,
      broadcast,
      justSigned,
    });
  };

  handleError = (event, err) => {
    console.error('multisig error:', err);
    this.setState({
      errorMessage: err,
    });
  }

  sign = async () => {
    this.setState({
      errorMessage: '',
    });
    if (await walletClient.isLocked()) {
      await new Promise((resolve, reject) => {
        this.props.getPassphrase(resolve, reject);
      });
    }
    ipc.send('MULTISIG/SIGN');
  }

  continue = () => {
    ipc.send('MULTISIG/CONTINUE');
  }

  export = async () => {
    const {t} = this.context;
    const {tx, metadata, maxSigsNeeded} = this.state;
    const data = JSON.stringify({
      version: 1,
      tx: tx.hex,
      metadata,
    });

    this.setState({
      errorMessage: '',
    });

    const savePath = dialog.showSaveDialogSync({
      defaultPath: getFileName(tx.hash, maxSigsNeeded),
      filters: [{name: 'Handshake Transaction', extensions: ['json']}],
    });

    await new Promise((resolve, reject) => {
      if (savePath) {
        fs.writeFile(savePath, data, (err) => {
          if (err) {
            reject(err);
            this.props.showError('Error: ' + err);
          } else {
            resolve(savePath);
            ipc.send('MULTISIG/CONTINUE');
            this.props.showSuccess(t('multisigSavedToFile'));
            this.setState({isVisible: false});
          }
        });
      }
    });
  };

  cancel = () => {
    ipc.send('MULTISIG/CANCEL');
    this.setState({
      isVisible: false,
      errorMessage: '',
      tx: null,
      multisigInfo: [],
      signerData: [],
      metadata: null,
      maxSigsNeeded: null,
      canAddOwnSig: true,
      broadcast: true,
      justSigned: false,
    });
  };

  render() {
    const {t} = this.context;
    const {
      isVisible,
      tx,
      signerData,
      metadata,
      maxSigsNeeded,
      canAddOwnSig,
      broadcast,
      justSigned,
    } = this.state;

    if (!isVisible) {
      return null;
    }

    const canSign = maxSigsNeeded > 0 && canAddOwnSig;
    const canBroadcastOrContinue = maxSigsNeeded === 0;

    return (
      <Modal className="multisig-modal__wrapper" onClose={this.cancel}>
        <div className="multisig-modal">
          <h2 className="multisig-modal__title">{t('multisigTransaction')}</h2>

          <TxViewer tx={tx} signerData={signerData} metadata={metadata} />

          <div className="multisig-modal__info">
            <p>
              {maxSigsNeeded === 0 ?
                t('multisigTxFullySigned')
                : canAddOwnSig ?
                  t('multisigTxAddOwnSign')
                  : t('multisigTxExportForOthers')
              }
            </p>

            {this.renderError()}
          </div>

          <div className="multisig-modal__cta-wrapper">
            {(canSign) && (
              <button
                className="multisig-modal__primary"
                onClick={this.sign}
              >
                {t('sign')}
              </button>
            )}
            {(canBroadcastOrContinue) && (
              <button
                className="multisig-modal__primary"
                onClick={this.continue}
              >
                {t(broadcast ? 'broadcast' : 'continue')}
              </button>
            )}
            {(justSigned) && (
              <button
                className={
                  (canSign || canBroadcastOrContinue)
                  ? "multisig-modal__secondary" : "multisig-modal__primary"
                }
                onClick={this.export}
              >
                {t('export')}
              </button>
            )}
            <button
              className="multisig-modal__secondary"
              onClick={this.cancel}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  renderError() {
    if (this.state.errorMessage) {
      return (
        <div className="multisig-modal__error">
          {this.state.errorMessage}
        </div>
      );
    }

    return null;
  }
}

function getFileName(hash, maxSigsNeeded) {
  // Example name: tx_2022-09-04_11-24_d8cb...464b_needs-2.json

  let name = 'tx';

  // Append date
  {
    function pad(number) {
      // Zero pad to length 2
      return number.toString().padStart(2, 0);
    }

    const now = new Date();
    name += `_${now.getUTCFullYear()}-${pad(now.getUTCMonth())}-${pad(now.getUTCDate())}_${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}`;
  }

  // Append hash
  {
    const shortHash = `${hash.slice(0,4)}...${hash.slice(-4)}`;
    name += '_' + shortHash;
  }

  // Append required sig count
  name += `_needs-${maxSigsNeeded}`;

  // Append file extension
  name += '.json';

  return name;
}