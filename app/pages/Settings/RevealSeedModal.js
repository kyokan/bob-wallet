import React, { Component } from 'react';
import './reveal-seed-modal.scss';
import { connect } from 'react-redux';
import MiniModal from '../../components/Modal/MiniModal';
import Submittable from '../../components/Submittable';
import * as walletActions from '../../ducks/walletActions';

@connect(
  (state) => ({
    walletWatchOnly: state.wallet.watchOnly,
  }),
  dispatch => ({
    revealSeed: passphrase => dispatch(walletActions.revealSeed(passphrase))
  })
)
class RevealSeedModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      passphrase: '',
      mnemonic: '',
      errorMessage: ''
    };
  }

  onClickReveal = async () => {
    try {
      const mnemonic = await this.props.revealSeed(this.state.passphrase);
      this.setState({
        mnemonic
      });
    } catch (e) {
      this.setState({
        errorMessage:
          typeof e === 'string' ? e : 'An error occurred, please try again.'
      });
    }
  };

  onChangePassphrase = e => {
    this.setState({
      passphrase: e.target.value
    });
  };

  render() {
    const { walletWatchOnly } = this.props;

    return (
      <MiniModal
        closeRoute="/settings/wallet"
        title="Reveal your seed phrase"
        centered
      >
        {walletWatchOnly
          ? "Seed phrases cannot be read from hardware wallets."
          : this.state.mnemonic
          ? this.renderMnemonic()
          : this.renderPassword()}
      </MiniModal>
    );
  }

  renderMnemonic() {
    return (
      <React.Fragment>
        <div className="reveal-seed-modal__instructions">
          Enter your password to reveal your seed phrase.
        </div>
        <div className="reveal-seed-modal__seed-phrase">
          {this.state.mnemonic}
        </div>
      </React.Fragment>
    );
  }

  renderPassword() {
    return (
      <React.Fragment>
        <div className="reveal-seed-modal__instructions">
          Enter your password to reveal your seed phrase.
        </div>
        <Submittable onSubmit={this.onClickReveal}>
          <input
            type="password"
            className="reveal-seed-modal__password"
            placeholder="Your password"
            value={this.state.passphrase}
            onChange={this.onChangePassphrase}
            autoFocus
          />
          {this.renderErrorMessage()}
        </Submittable>
        <button
          className="reveal-seed-modal__submit"
          onClick={this.onClickReveal}
        >
          Reveal recovery phrase
        </button>
      </React.Fragment>
    );
  }

  renderErrorMessage() {
    if (!this.state.errorMessage) {
      return null;
    }

    return (
      <div className="reveal-seed-modal__error-message">
        {this.state.errorMessage}
      </div>
    );
  }
}

export default RevealSeedModal;
