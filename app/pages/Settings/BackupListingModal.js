import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import MiniModal from '../../components/Modal/MiniModal';
import './interstitial-warning-modal.scss';
import PropTypes from 'prop-types';
import Checkbox from '../../components/Checkbox';
import {I18nContext} from "../../utils/i18n";

@withRouter
export default class BackupListingModal extends Component {
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
      acceptances: [false, false],
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
      !this.state.acceptances[1]
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
        closeRoute="/settings/exchange"
        title={t('backupYourListing')}
      >
        <div className="interstitial-warning-modal__instructions">
          {t('backupListingWarningHeader')}
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(0)}
            checked={this.state.acceptances[0]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            {t('backupListingWarning1')}
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(1)}
            checked={this.state.acceptances[1]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            {t('backupListingWarning2')}
          </div>
        </div>
        <div className="interstitial-warning-modal__buttons">
          <button
            className="interstitial-warning-modal__cancel-button"
            onClick={this.onClickCancel}
          >
            {t('cancel')}
          </button>
          <button
            className="backup-listing-modal__download-button"
            disabled={this.checkDisabled()}
            onClick={this.onClickSubmit}
          >
            {t('download')}
          </button>
        </div>
      </MiniModal>
    );
  }
}
