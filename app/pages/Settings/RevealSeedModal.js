import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './reveal-seed-modal.scss';
import { connect } from 'react-redux';
import MiniModal from '../../components/Modal/MiniModal';
import Submittable from '../../components/Submittable';
import PhraseMismatch from '../../components/PhraseMismatch';
import * as walletActions from '../../ducks/walletActions';
import {I18nContext} from "../../utils/i18n";

@connect(
  (state) => ({
    wid: state.wallet.wid,
    walletWatchOnly: state.wallet.watchOnly,
    phraseMismatch: state.wallet.phraseMismatch,
  }),
  dispatch => ({
    revealSeed: passphrase => dispatch(walletActions.revealSeed(passphrase))
  })
)
class RevealSeedModal extends Component {
  static propTypes = {
    wid: PropTypes.string.isRequired,
    walletWatchOnly: PropTypes.bool.isRequired,
    phraseMismatch: PropTypes.bool.isRequired,
    revealSeed: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);

    this.state = {
      passphrase: '',
      mnemonic: '',
      xpriv: '',
      errorMessage: ''
    };
  }

  onClickReveal = async () => {
    try {
      const {phrase: mnemonic, xpriv} = await this.props.revealSeed(this.state.passphrase);
      this.setState({ mnemonic, xpriv });
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
          : this.state.xpriv
          ? this.renderMnemonic()
          : this.renderPassword()}
      </MiniModal>
    );
  }

  renderMnemonic() {
    const {phraseMatchesKey} = this.props;
    const {mnemonic} = this.state;

    // View seed phrase
    if (phraseMatchesKey) {
      return (
        <div className="reveal-seed-modal__seed-phrase">
          {mnemonic}
        </div>
      )
    }

    // Phrase doesn't match, show warning alert/modal
    return <PhraseMismatch />;
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
