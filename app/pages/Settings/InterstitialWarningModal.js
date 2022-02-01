import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import MiniModal from '../../components/Modal/MiniModal';
import './interstitial-warning-modal.scss';
import PropTypes from 'prop-types';
import Checkbox from '../../components/Checkbox';
import {I18nContext} from "../../utils/i18n";

@withRouter
export default class InterstitialWarningModal extends Component {
  static propTypes = {
    nextRoute: PropTypes.string.isRequired,
    nextAction: PropTypes.func,
  };

  static defaultProps = {
    nextAction: () => Promise.resolve(),
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);

    this.state = {
      acceptances: [false, false, false, false],
    };
  }

  toggleCheck(i) {
    return () => {
      const acceptances = this.state.acceptances;
      acceptances[i] = !acceptances[i];

      this.setState({
        acceptances,
      });
    };
  }

  checkDisabled = () => {
    return (
      !this.state.acceptances[0] ||
      !this.state.acceptances[1] ||
      !this.state.acceptances[2] ||
      !this.state.acceptances[3]
    );
  };

  onClickCancel = () => {
    this.props.history.push('/settings');
  };

  onClickSubmit = async () => {
    await this.props.nextAction();
    this.props.history.push(this.props.nextRoute);
  };

  render() {
    const {t} = this.context;

    return (
      <MiniModal
        closeRoute="/settings/wallet"
        title={t('removeWalletTitle')}
      >
        <div className="interstitial-warning-modal__instructions">
          {t('removeWalletInstruction')}
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(0)}
            checked={this.state.acceptances[0]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            {t('removeWalletAck1')}
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(1)}
            checked={this.state.acceptances[1]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            {t('removeWalletAck2')}
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(2)}
            checked={this.state.acceptances[2]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            {t('removeWalletAck3')}
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(3)}
            checked={this.state.acceptances[3]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            {t('removeWalletAck4')}
          </div>
        </div>
        <div className="interstitial-warning-modal__buttons">
          <button
            className="interstitial-warning-modal__cancel-button"
            onClick={this.onClickCancel}
          >
            {t('removeWalletCancel')}
          </button>
          <button
            className="interstitial-warning-modal__submit-button"
            disabled={this.checkDisabled()}
            onClick={this.onClickSubmit}
          >
            {t('removeWalletCTA')}
          </button>
        </div>
      </MiniModal>
    );
  }
}
