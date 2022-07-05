import fs from 'fs';
import React, { Component } from 'react';
import { connect } from "react-redux";
import PropTypes from 'prop-types';
import c from 'classnames';
import Alert from '../Alert';
import MiniModal from '../Modal/MiniModal';
import { getPassphrase, revealSeed } from "../../ducks/walletActions";
import { I18nContext } from '../../utils/i18n';
import walletClient from "../../utils/walletClient";
import './phrase-mismatch.scss';
const { dialog } = require('@electron/remote');


@connect(
  (state) => ({
    wid: state.wallet.wid,
    phraseMismatch: state.wallet.phraseMismatch,
  }),
  (dispatch) => ({
    getPassphrase: (resolve, reject) => dispatch(getPassphrase(resolve, reject)),
    revealSeed: passphrase => dispatch(revealSeed(passphrase))
  })
)
export default class PhraseMismatch extends Component {
  static propTypes = {
    phraseMismatch: PropTypes.bool.isRequired,
    getPassphrase: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  state = {
    isOpen: false,
    error: false,
    message: '',
  };

  onClickSaveMasterKey = async () => {
    const {wid, getPassphrase, revealSeed} = this.props;

    this.setState({
      error: false,
      message: '',
    });

    let master;
    try {
      const passphrase = await new Promise((resolve, reject) => getPassphrase(resolve, reject));
      if (!passphrase) return;

      const revealSeedRes = await revealSeed(passphrase);
      master = revealSeedRes.master;

      await walletClient.lock();
    } catch (e) {
      this.setState({
        error: true,
        message:
          typeof e === 'string' ? e : `An error occurred, please try again: ${e?.message}`
      });
      return;
    }

    const data = JSON.stringify(master);
    const savePath = dialog.showSaveDialogSync({
      defaultPath: `master-key-for-wallet-${wid}.json`,
      filters: [{name: 'Master Key backup', extensions: ['json']}],
    });

    await new Promise((resolve, reject) => {
      if (savePath) {
        fs.writeFile(savePath, data, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(savePath);
          }
        });
      }
    });

    this.setState({
      error: false,
      message: 'Saved to file.',
    });
  }

  render() {
    const {isOpen} = this.state;
    const {phraseMismatch} = this.props;

    // Hide everything if good phrase
    if (!phraseMismatch)
      return null;

    return (
      <>
        {/* Alert always visible */}
        {this.renderAlert()}

        {/* Modal only when open */}
        {isOpen && this.renderModal()}
      </>
    )
  }

  renderAlert() {
    const {t} = this.context;

    return (
      <div onClick={() => this.setState({ isOpen: true })}>
        <Alert
          type="error"
          className="phrase-mismatch-alert"
          message={t('phraseMismatchAlert')}
        />
      </div>
    );
  }

  renderModal() {
    const {wid} = this.props;
    const {t} = this.context;

    return (
      <MiniModal
        title="Wallet Phrase Mismatch"
        className="phrase-mismatch-modal"
        onClose={() => this.setState({ isOpen: false })}
        centered
      >
        <div className="section">
          {t('phraseMismatchText1', wid)}
        </div>
        <div className="section">
          <p>{t('howAmIAffected')}</p>
          <p>
            {t('phraseMismatchText2')}
          </p>
          <p>
            {t('phraseMismatchText3')}
          </p>
        </div>
        <div className="section">
          <p>{t('whatCanIDo')}</p>
          <p>
            {t('phraseMismatchText4')}
          </p>
          <p>
            {t('phraseMismatchText5')}
          </p>
        </div>

        {this.renderMessage()}

        <div className="actions">
          <button
            onClick={() => this.onClickSaveMasterKey()}
          >
            {t('downloadMasterKey')}
          </button>
        </div>
      </MiniModal>
    );
  }

  renderMessage() {
    const {error, message} = this.state;

    if (!message) {
      return null;
    }

    return (
      <div className={c('message', {'message--error': error})}>
        {message}
      </div>
    );
  }
}
