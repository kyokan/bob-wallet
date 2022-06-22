import React, { Component } from 'react';
import { connect } from 'react-redux';
import MiniModal from '../../components/Modal/MiniModal';
import {I18nContext} from "../../utils/i18n";
import './account-key-modal.scss';

@connect(
  (state) => ({
    accountKey: state.wallet.accountKey,
  }),
  dispatch => ({
  })
)
class AccountKeyModal extends Component {
  static contextType = I18nContext;

  constructor(props) {
    super(props);

    this.state = {};
  }

  render() {
    const {t} = this.context;

    return (
      <MiniModal
        closeRoute="/settings/wallet"
        title={t('settingAccountKeyCTA')}
        centered
      >
        <div className="account-key__instructions">
          {t('settingAccountKeyDesc')}
        </div>
        <div className="account-key__seed-phrase">
          {this.props.accountKey}
        </div>
      </MiniModal>
    );
  }
}

export default AccountKeyModal;
