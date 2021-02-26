import React, {Component} from "react";
import MiniModal from "../../components/Modal/MiniModal";
import {Route, withRouter} from "react-router-dom";
import Checkbox from "../../components/Checkbox";
import Anchor from "../../components/Anchor";
import Alert from "../../components/Alert";

@withRouter
export default class DeepCleanAndRescanModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasBackup: false,
    }
  }

  render() {
    const { hasBackup } = this.state;
    return (
      <MiniModal
        closeRoute="/settings/wallet"
        title="Deep Clean + Rescan"
        centered
      >
        <Alert
          type="warning"
        >
          This action wipes out balance and transaction history in the wallet DB but retains key hashes and name maps. It should be used only if the wallet state has been corrupted by issues like the <Anchor href="https://github.com/handshake-org/hsd/issues/454">reserved name registration bug</Anchor> or the <Anchor href="https://github.com/handshake-org/hsd/pull/464">locked coins balance after FINALIZE bug</Anchor>.
        </Alert>
        <div className="interstitial-warning-modal__checkbox">
          <Checkbox
            className="interstitial-warning-modal__checkbox-box"
            onChange={() => this.setState({ hasBackup: !hasBackup })}
            checked={hasBackup}
          />
          <div className="interstitial-warning-modal__checkbox-label">
            I have my recovery seed phrase backed up.
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
          Deep Clean and Rescan
        </button>
      </MiniModal>
    );
  }
}
