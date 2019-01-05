import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal';
import './proof-modal.scss';
import { remote, shell } from 'electron'
import ellipsify from '../../utils/ellipsify';
import { connect } from 'react-redux';
import { showSuccess } from '../../ducks/notifications';
import { clientStub } from '../../background/airdrop';
import Alert from '../Alert';

const airdropClient = clientStub(() => require('electron').ipcRenderer);

const dialog = remote.dialog;

@connect(
  (state) => ({
    address: state.wallet.address
  }),
  (dispatch) => ({
    showSuccess: (message) => dispatch(showSuccess(message))
  })
)
export default class ProofModal extends Component {
  static propTypes = {
    type: PropTypes.string.isRequired,
    address: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
  };

  state = {
    chosenKey: '',
    passphrase: '',
    keyId: '',
    errorMessage: ''
  };

  onClickChooseKey(title, defaultPath) {
    dialog.showOpenDialog({
      title,
      defaultPath,
      buttonLabel: 'Choose',
      properties: [
        'openFile',
        'showHiddenFiles'
      ]
    }, (paths) => {
      if (!paths) {
        return;
      }

      this.setState({
        chosenKey: paths[0]
      });
    });
  }

  setPassphrase = (e) => this.setState({
    passphrase: e.target.value
  });

  setKeyId = (e) => this.setState({
    keyId: e.target.value
  });

  onSubmit = async () => {
    const { chosenKey, passphrase, keyId } = this.state;
    const { address } = this.props;

    try {
      await airdropClient.proveFaucet(chosenKey, keyId, address, '0.5', passphrase);
    } catch (e) {
      this.setState({
        errorMessage: this.parseError(e)
      });
      return;
    }

    this.props.onClose();
    this.props.showSuccess('Airdrop confirmed! Your coins should appear within 15 minutes.');
  };

  parseError(e) {
    const defaultMessage = 'Something went wrong.';
    if (!e.message) {
      return defaultMessage;
    }

    if (e.message.match(/invalid address hrp/i)) {
      return 'Airdrops are not supported on this network.';
    }

    if (e.message.match(/pem parse error/i)) {
      return 'Couldn\'t read your private key - did you choose the public key by mistake?';
    }

    if (e.message.match(/invalid pgp key id/i)) {
      return 'Invalid PGP key ID.';
    }

    if (e.message.match(/invalid checksum/i)) {
      return 'Invalid checksum - did you enter your passphrase correctly?';
    }

    return defaultMessage;
  }

  isDisabled() {
    if (this.props.type === 'PGP') {
      return !this.state.chosenKey || !this.state.keyId;
    }

    return !this.state.chosenKey;
  }

  render() {
    const {
      onClose,
      type,
    } = this.props;

    return (
      <Modal className="proof" onClose={onClose}>
        <div className="proof__container">
          <div className="proof__header">
            <div
              className="proof__title">{type === 'PGP' ? 'Claim your coins with PGP' : 'Claim your coins with SSH'}</div>
            <div className="proof__close-btn" onClick={onClose}>
              ✕
            </div>
          </div>
          <div className="proof__content">
            <Alert type="error" message={this.state.errorMessage} />
            {type === 'PGP' ? this.renderPGP() : this.renderSSH()}
          </div>
        </div>
      </Modal>
    );
  }

  renderPGP() {
    return (
      <React.Fragment>
        <div className="proof__step">
          <div className="proof__step-title">
            <span className="proof__step-title--bolded">Step 1:</span>
            <span>Find your PGP key.</span>
          </div>
          <div className="proof__step-description">
            Using the file picker below, find the your strong set PGP key. <strong>Your key will never leave
            this device.</strong>
          </div>
          <div className="proof__choose-key">
            <button className="proof__choose-key-btn" onClick={() => this.onClickChooseKey('Choose SSH key', '~/.ssh')}>
              Choose Key
            </button>
            <div className="proof__choose-key-path">
              {ellipsify(this.state.chosenKey, 30)}
            </div>
          </div>
        </div>
        <div className="proof__step">
          <div className="proof__step-title">
            <span className="proof__step-title--bolded">Step 2:</span>
            <span>Enter your key's passphrase.</span>
          </div>
          <div className="proof__step-description">
            Leave this blank if your key doesn't have a passphrase. <strong>Your passphrase will never leave this
            device.</strong>
          </div>
          <div className="proof__text-input">
            <input
              type="password"
              value={this.state.passphrase}
              onChange={this.setPassphrase}
            />
          </div>
        </div>
        <div className="proof__step">
          <div className="proof__step-title">
            <span className="proof__step-title--bolded">Step 3:</span>
            <span>Enter your key's ID.</span>
          </div>
          <div className="proof__step-description">
            You can find this by looking at your PGP key management tool.
          </div>
          <div className="proof__text-input">
            <input
              type="text"
              value={this.state.keyId}
              onChange={this.setKeyId}
            />
          </div>
        </div>
        <div className="proof__footer">
          <button
            className="proof__details-btn"
            onClick={() => shell.openExternal('https://github.com/handshake-org/hs-airdrop')}
          >
            See full details
          </button>
          <button className="proof__submit-btn" onClick={this.onSubmit} disabled={this.isDisabled()}>
            Claim Coins
          </button>
        </div>
      </React.Fragment>
    );
  }

  renderSSH() {
    return (
      <React.Fragment>
        <div className="proof__step">
          <div className="proof__step-title">
            <span className="proof__step-title--bolded">Step 1:</span>
            <span>Find your SSH key.</span>
          </div>
          <div className="proof__step-description">
            Using the file picker below, find the SSH private key you use on GitHub. <strong>Your key will never leave
            this device.</strong>
          </div>
          <div className="proof__choose-key">
            <button className="proof__choose-key-btn" onClick={() => this.onClickChooseKey('Choose SSH key', '~/.ssh')}>
              Choose Key
            </button>
            <div className="proof__choose-key-path">
              {ellipsify(this.state.chosenKey, 30)}
            </div>
          </div>
        </div>
        <div className="proof__step">
          <div className="proof__step-title">
            <span className="proof__step-title--bolded">Step 2:</span>
            <span>Enter your key's passphrase.</span>
          </div>
          <div className="proof__step-description">
            Leave this blank if your key doesn't have a passphrase. <strong>Your passphrase will never leave this
            device.</strong>
          </div>
          <div className="proof__text-input">
            <input
              type="password"
              value={this.state.passphrase}
              onChange={this.setPassphrase}
            />
          </div>
        </div>
        <div className="proof__footer">
          <button
            className="proof__details-btn"
            onClick={() => shell.openExternal('https://github.com/handshake-org/hs-airdrop')}
          >
            See full details
          </button>
          <button className="proof__submit-btn" onClick={this.onSubmit} disabled={this.isDisabled()}>
            Claim Coins
          </button>
        </div>
      </React.Fragment>
    );
  }
}
