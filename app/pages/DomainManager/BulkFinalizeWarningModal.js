import React, {Component} from "react";
import MiniModal from "../../components/Modal/MiniModal";
import {withRouter} from "react-router-dom";
import Checkbox from "../../components/Checkbox";
import Alert from "../../components/Alert";
import PropTypes from 'prop-types'

@withRouter
export default class BulkFinalizeWarningModal extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    onClick: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      hasConfirmed: false,
    }
  }

  render() {
    const { hasConfirmed } = this.state;
    return (
      <MiniModal
        onClose={this.props.onClose}
        title="Bulk Finalize"
        centered
      >
        <Alert
          type="warning"
        >
          Make sure there are no pending finalize in the Exchange tab. If there are pending finalize in Exchange, you will need finalize them individually before continuing.
        </Alert>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={() => this.setState({ hasConfirmed: !hasConfirmed })}
            checked={hasConfirmed}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            I have no pending finalize in Exchange tab.
          </div>
        </div>
        <button
          className="settings__btn"
          onClick={this.props.onClick}
          disabled={!hasConfirmed}
        >
          Finalize All
        </button>
      </MiniModal>
    );
  }
}
