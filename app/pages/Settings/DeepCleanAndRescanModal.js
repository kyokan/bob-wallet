import React, {Component} from "react";
import MiniModal from "../../components/Modal/MiniModal";
import {withRouter} from "react-router-dom";
import Checkbox from "../../components/Checkbox";
import Anchor from "../../components/Anchor";
import Alert from "../../components/Alert";
import walletClient from '../../utils/walletClient';
import {I18nContext} from "../../utils/i18n";

@withRouter
export default class DeepCleanAndRescanModal extends Component {
  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = {
      hasBackup: false,
    }
  }

  render() {
    const { hasBackup } = this.state;
    const {t} = this.context;
    return (
      <MiniModal
        closeRoute="/settings/wallet"
        title={t('deepcleanTitle')}
        centered
      >
        <Alert
          type="warning"
        >
          {t('deepcleanWarning')}
        </Alert>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={() => this.setState({ hasBackup: !hasBackup })}
            checked={hasBackup}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            {t('deepcleanBackupAck')}
          </div>
        </div>
        <button
          className="settings__btn"
            onClick={async () => {
              if (!hasBackup) return;
              await walletClient.deepClean();
              walletClient.rescan(0);
              this.props.history.push('/settings/wallet');
          }}
          disabled={!hasBackup}
        >
          {t('deepcleanTitle')}
        </button>
      </MiniModal>
    );
  }
}
