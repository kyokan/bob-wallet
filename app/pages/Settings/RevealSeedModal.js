import React, { Component } from 'react';
import './reveal-seed-modal.scss';
import { connect } from 'react-redux';
import MiniModal from '../../components/Modal/MiniModal';
import Submittable from '../../components/Submittable';
import * as walletActions from '../../ducks/walletActions';
import {I18nContext} from "../../utils/i18n";

@connect(
  (state) => ({
    walletWatchOnly: state.wallet.watchOnly,
  }),
  dispatch => ({
    revealSeed: passphrase => dispatch(walletActions.revealSeed(passphrase))
  })
)
class RevealSeedModal extends Component {
  static contextType = I18nContext;

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
          typeof e === 'string' ? e : `An error occurred, please try again: ${e?.message}`
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
    const {t} = this.context;

    return (
      <MiniModal
        closeRoute="/settings/wallet"
        title={t('revealSeedTitle')}
        centered
      >
        {walletWatchOnly
          ? t('revealSeedNoLedger')
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
          {this.context.t('revealSeedEnterPW')}
        </div>
        <div className="reveal-seed-modal__seed-phrase">
          {this.state.mnemonic}
        </div>
      </React.Fragment>
    );
  }

  renderPassword() {
    const {t} = this.context;

    return (
      <React.Fragment>
        <div className="reveal-seed-modal__instructions">
          {t('revealSeedEnterPW')}
        </div>
        <Submittable onSubmit={this.onClickReveal}>
          <input
            type="password"
            className="reveal-seed-modal__password"
            placeholder={t('revealSeedPlaceholder')}
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
          {t('revealSeedCTA')}
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
