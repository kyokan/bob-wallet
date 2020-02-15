import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal';
import './proof-modal.scss';
import { shell } from 'electron';
import { connect } from 'react-redux';
import { showSuccess } from '../../ducks/notifications';
import walletClient from '../../utils/walletClient';
import Alert from '../Alert';
import { clientStub as aClientStub } from '../../background/analytics/client';
import {NETWORKS} from "../../constants/networks";

const analytics = aClientStub(() => require('electron').ipcRenderer);

@connect(
  (state) => ({
    address: state.wallet.address,
    network: state.node.network,
    chainHeight: state.node.chain ? state.node.chain.height : -1,
  }),
  (dispatch) => ({
    showSuccess: (message) => dispatch(showSuccess(message)),
  }),
)
export default class ProofModal extends Component {
  static propTypes = {
    type: PropTypes.string.isRequired,
    address: PropTypes.string.isRequired,
    network: PropTypes.string.isRequired,
    chainHeight: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
  };

  state = {
    proof: '',
    errorMessage: '',
    isUploading: false,
  };

  componentDidMount() {
    analytics.screenView('Proof Modal', {
      type: this.props.type,
    });
  }

  setProof = (e) => this.setState({
    proof: e.target.value,
  });

  onSubmit = async () => {
    this.setState({isUploading: true});

    try {
      await walletClient.sendRawAirdrop(this.state.proof);
      analytics.track('airdrop claimed', {
        type: this.props.type,
      });
    } catch (e) {
      console.error(e);
      this.setState({
        errorMessage: 'Invalid proof. Please try again.',
      });
      return;
    } finally {
      this.setState({isUploading: false});
    }

    this.props.onClose();
    this.props.showSuccess('Airdrop confirmed! Your coins should appear within 15 minutes.');
  };

  isDisabled() {
    const { network, chainHeight } = this.props;

    if (network === NETWORKS.MAINNET && chainHeight < 2016) {
      return true;
    }

    return !this.state.proof;
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
          {this.renderInfoBox()}
          <div className="proof__content">
            <Alert type="error" message={this.state.errorMessage} />
            {this.renderPGP(type)}
          </div>
        </div>
      </Modal>
    );
  }

  renderPGP(type) {
    let command = '';

    if (type === 'PGP') {
      command = 'hs-airdrop [key-path] [key-id] [addr] -f 0.5';
    } else if (type === 'SSH') {
      command = 'hs-airdrop [key-path] [addr] -f 0.5';
    } else if (type === 'Faucet') {
      command = 'hs-airdrop [addr] -f 0.5'
    }

    return (
      <React.Fragment>
        <div className="proof__step">
          <div className="proof__step-title">
            <span className="proof__step-title--bolded">Step 1:</span>
            <span>Install hs-airdrop.</span>
          </div>
          <div className="proof__step-description">
            Head on over to <a onClick={() => shell.openExternal('https://github.com/handshake-org/hs-airdrop')}>hs-airdrop on GitHub</a>, and
            install the tool using the instructions in the README.
          </div>
        </div>
        <div className="proof__step">
          <div className="proof__step-title">
            <span className="proof__step-title--bolded">Step 2:</span>
            <span>Generate your airdrop proof.</span>
          </div>
          <div className="proof__step-description">
            To generate your airdrop proof, you'll need to run the following commands in your terminal:

            <pre className="proof__cli-step">
              <code>
                {command}
              </code>
            </pre>

            If everything went well, you should see a base64-encoded string in your terminal - that's your proof.
            Broadcasting the proof on-chain will send your airdrop to this wallet.
          </div>
        </div>
        <div className="proof__step">
          <div className="proof__step-title">
            <span className="proof__step-title--bolded">Step 3:</span>
            <span>Enter your proof.</span>
          </div>
          <div className="proof__step-description">
            Copy the base64-encoded proof from your terminal into the box below.
          </div>
          <div className="proof__text-input">
            <textarea
              value={this.state.proof}
              onChange={this.setProof}
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
          <button className="proof__submit-btn" onClick={this.onSubmit}
                  disabled={this.isDisabled() || this.state.isUploading}>
            {this.state.isUploading ? 'Uploading...' : 'Claim Coins'}
          </button>
        </div>
      </React.Fragment>
    );
  }

  renderInfoBox() {
    const { network, chainHeight } = this.props;
    if (network === NETWORKS.MAINNET && chainHeight < 2016) {
      return (
        <div className="proof__alert">
          <strong>Important:</strong> Transactions are disabled on mainnet until block 2,016 (about 2 weeks). The network will reject proofs sent before then, so be sure to wait!
        </div>
      );
    }

    return null;
  }
}
