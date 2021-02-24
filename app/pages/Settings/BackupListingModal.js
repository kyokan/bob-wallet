import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import MiniModal from '../../components/Modal/MiniModal';
import './interstitial-warning-modal.scss';
import PropTypes from 'prop-types';
import Checkbox from '../../components/Checkbox';

@withRouter
export default class BackupListingModal extends Component {
  static propTypes = {
    nextRoute: PropTypes.string.isRequired,
    nextAction: PropTypes.func,
  };

  static defaultProps = {
    nextAction: () => Promise.resolve(),
  };

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
    return (
      <MiniModal
        closeRoute="/settings/exchange"
        title="Backup your listing"
      >
        <div className="interstitial-warning-modal__instructions">
          This will generate a backup file containing your encrypted private keys for all of your listings. Be sure to store this file somewhere safe after it is downloaded.
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(0)}
            checked={this.state.acceptances[0]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            I will need my password to restore access to my names in case they are not sold.
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(1)}
            checked={this.state.acceptances[1]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            I will store this file somewhere safe.
          </div>
        </div>
        <div className="interstitial-warning-modal__buttons">
          <button
            className="interstitial-warning-modal__cancel-button"
            onClick={this.onClickCancel}
          >
            Cancel
          </button>
          <button
            className="backup-listing-modal__download-button"
            disabled={this.checkDisabled()}
            onClick={this.onClickSubmit}
          >
            Download File
          </button>
        </div>
      </MiniModal>
    );
  }
}
