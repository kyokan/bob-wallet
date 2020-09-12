import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import './transfer-details.scss';
import * as names from '../../ducks/names';
import { showError, showSuccess } from '../../ducks/notifications';
import { clientStub as aClientStub } from '../../background/analytics/client';
import * as networks from 'hsd/lib/protocol/networks';
import Checkbox from '../../components/Checkbox';
import FinalizeWithPaymentModal from './FinalizeWithPaymentModal';

const analytics = aClientStub(() => require('electron').ipcRenderer);

class TransferDetails extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    domain: PropTypes.object,
  };

  constructor(props) {
    super(props);

    this.state = {
      recipient: '',
      acceptances: [false, false, false],
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
      !this.state.acceptances[2]
    );
  };

  sendTransfer = () => {
    this.props.sendTransfer(this.state.recipient)
      .then(() => {
        this.props.showSuccess('Your transfer request is submitted! Please wait around 15 minutes for it to be confirmed.');
        analytics.track('transferred domain');
      })
      .catch(e => this.props.showError(e.message));
  };

  cancelTransfer = () => {
    this.props.cancelTransfer()
      .then(() => {
        this.props.showSuccess('Your cancellation request is submitted! Please wait around 15 minutes for it to be confirmed.');
        analytics.track('cancelled transfer');
      })
      .catch(e => this.props.showError(e.message));
  };

  revokeName = () => {
    this.props.revokeName()
      .then(() => {
        this.props.showSuccess('This name has been revoked. Please wait around 15 minutes for it to be confirmed.');
        analytics.track('revoked name');
      })
      .catch(e => this.props.showError(e.message));
  };

  finalizeTransfer = () => {
    this.props.finalizeTransfer()
      .then(() => {
        this.props.showSuccess('Your transfer is finalized! Please wait around 15 minutes for it to be confirmed.');
        analytics.track('finalized transfer');
      })
      .catch(e => this.props.showError(e.message));
  };

  finalizeWithPayment = () => {
    // node.finalizeWithPayment(this.props.name, '', '', 100);
    this.setState({
      isShowingFinalizeWithPayment: true,
    });
  };

  render() {
    const domain = this.props.domain || {};
    const {info} = domain;

    if (!info) {
      return (
        <div className="transfer-details">
          Loading...
        </div>
      );
    }

    if (domain.pendingOperation === 'TRANSFER') {
      return (
        <div className="transfer-details">
          <p>
            Your transfer is in progress. Please check back in about 15 minutes.
          </p>
        </div>
      );
    }

    if (info.transfer) {
      const remainingBlocks = (info.transfer + networks[this.props.network].names.transferLockup) - this.props.height;

      if (remainingBlocks <= 0) {
        return (
          <div className="transfer-details">
            <p>
              You must finalize your transfer before it can complete.
            </p>
            <p>
              <button className="extension_cta_button transfer-details__danger" onClick={this.cancelTransfer}>
                Cancel Transfer
              </button>
              <button className="extension_cta_button" onClick={this.finalizeTransfer}>
                Finalize Transfer
              </button>
              <button className="extension_cta_button" onClick={this.finalizeWithPayment}>
                Finalize With Payment
              </button>
            </p>
            {this.state.isShowingFinalizeWithPayment && (
              <FinalizeWithPaymentModal
                onClose={() => this.setState({
                  isShowingFinalizeWithPayment: false,
                })}
                name={this.props.name}
              />
            )}
            {this.renderRevoke()}
          </div>
        );
      }

      return (
        <div className="transfer-details">
          <p>
            Your transfer is in progress. You will be able to finalize the transfer in {remainingBlocks} blocks.
          </p>
          <p>
            <button className="extension_cta_button transfer-details__danger" onClick={this.cancelTransfer}>
              Cancel Transfer
            </button>
          </p>
          {this.renderRevoke()}
        </div>
      );
    }

    return (
      <div className="transfer-details">
        <div className="transfer-details__form">
          <div className="transfer-details__inputs">
            <input
              type="text"
              value={this.state.recipient}
              onChange={(e) => this.setState({
                recipient: e.target.value,
              })}
              placeholder="Enter a recipient..."
            />
          </div>
          <div className="transfer-details__cta">
            <button
              className="extension_cta_button"
              disabled={!this.state.recipient}
              onClick={this.sendTransfer}
            >
              Transfer
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderRevoke() {
    return (
      <>
        <p>
          <strong>For emergency use only:</strong> If someone has compromised your key or transferred this name
          without
          your permission, you can revoke the name. Revoking a name will release it back to the public.
        </p>
        <p>
          To revoke this name, please acknowledge the following:
        </p>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(0)}
            checked={this.state.acceptances[0]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            The name will go back into the public auction pool.
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(1)}
            checked={this.state.acceptances[1]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            The only way to own this name again is to win it again at auction.
          </div>
        </div>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={this.toggleCheck(2)}
            checked={this.state.acceptances[2]}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            There is no way to undo this action.
          </div>
        </div>
        <p>
          <button
            className="extension_cta_button"
            onClick={this.revokeName}
            disabled={this.checkDisabled()}
          >
            Revoke Name
          </button>
        </p>
      </>
    );
  }
}

export default connect(
  (state, ownProps) => ({
    domain: state.names[ownProps.name],
    height: state.node.chain.height,
    network: state.node.network,
  }),
  (dispatch, ownProps) => ({
    sendTransfer: (recipient) => dispatch(names.sendTransfer(ownProps.name, recipient)),
    cancelTransfer: () => dispatch(names.cancelTransfer(ownProps.name)),
    finalizeTransfer: () => dispatch(names.finalizeTransfer(ownProps.name)),
    revokeName: () => dispatch(names.revokeName(ownProps.name)),
    showSuccess: (message) => dispatch(showSuccess(message)),
    showError: (message) => dispatch(showError(message)),
  }),
)(TransferDetails);
