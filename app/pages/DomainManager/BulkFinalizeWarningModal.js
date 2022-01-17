import React, {Component} from "react";
import MiniModal from "../../components/Modal/MiniModal";
import {withRouter} from "react-router-dom";
import Checkbox from "../../components/Checkbox";
import Alert from "../../components/Alert";
import PropTypes from 'prop-types'
import {I18nContext} from "../../utils/i18n";

@withRouter
export default class BulkFinalizeWarningModal extends Component {
  static propTypes = {
    onClose: PropTypes.func.isRequired,
    onClick: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = {
      hasConfirmed: false,
    }
  }

  render() {
    const { hasConfirmed } = this.state;
    const { t } = this.context;

    return (
      <MiniModal
        onClose={this.props.onClose}
        title={t('bulkFinalize')}
        centered
      >
        <Alert
          type="warning"
        >
          {t('bulkFinalizeWarning')}
        </Alert>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={() => this.setState({ hasConfirmed: !hasConfirmed })}
            checked={hasConfirmed}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            {t('bulkFinalizeConfirm')}
          </div>
        </div>
        <button
          className="settings__btn"
          onClick={this.props.onClick}
          disabled={!hasConfirmed}
        >
          {t('finalizeAll')}
        </button>
      </MiniModal>
    );
  }
}
