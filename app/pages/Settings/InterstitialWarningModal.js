import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import MiniModal from '../../components/Modal/MiniModal';
import './interstitial-warning-modal.scss';
import PropTypes from 'prop-types';
import Checkbox from '../../components/Checkbox';

@withRouter
export default class InterstitialWarningModal extends Component {
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
    return (
      <MiniModal
        closeRoute="/settings/wallet"
        title="Are you sure you want to do this?"
      >
        <div className="interstitial-warning-modal__instructions">
          You are about to remove your current wallet from Bob. Be sure you have your current recovery seed phrase saved
          somewhere safe before proceeding.
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(0)}
            checked={this.state.acceptances[0]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            I have my recovery seed phrase backed up.
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(1)}
            checked={this.state.acceptances[1]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            I will need my recovery seed phrase to log in again.
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(2)}
            checked={this.state.acceptances[2]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            There will be no way to recover my seed.
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(3)}
            checked={this.state.acceptances[3]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            I will need to re-import nonces for all of my active bids.
          </div>
        </div>
        <div className="interstitial-warning-modal__buttons">
          <button
            className="interstitial-warning-modal__cancel-button"
            onClick={this.onClickCancel}
          >
            Cancel, keep wallet
          </button>
          <button
            className="interstitial-warning-modal__submit-button"
            disabled={this.checkDisabled()}
            onClick={this.onClickSubmit}
          >
            Yes, remove wallet
          </button>
        </div>
      </MiniModal>
    );
  }
}
