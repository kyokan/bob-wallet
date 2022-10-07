import fs from 'fs';
import React, { Component } from "react";
import PropTypes from "prop-types";
import { withRouter } from "react-router";
import { connect } from "react-redux";
import { isBase58 } from 'hsd/lib/hd/public';
import * as walletActions from "../../ducks/walletActions";
import { showError, showSuccess } from "../../ducks/notifications";
import {HeaderItem, HeaderRow, Table, TableItem, TableRow} from "../../components/Table";
import Alert from "../../components/Alert";
import CopyButton from "../../components/CopyButton";
import walletClient from "../../utils/walletClient";
import {I18nContext} from "../../utils/i18n";
import {parseTxFile} from "../../utils/parsers";
import "./multisig.scss";

const { dialog } = require('@electron/remote');


@withRouter
@connect(
  (state) => ({
    network: state.wallet.network,
    walletId: state.wallet.wid,
    walletInitialized: state.wallet.initialized,
    walletM: state.wallet.m,
    walletN: state.wallet.n,
    accountKey: state.wallet.accountKey,
    walletKeys: state.wallet.keys,
    walletKeysNames: state.wallet.keysNames,
  }),
  (dispatch) => ({
    fetchWallet: () => dispatch(walletActions.fetchWallet()),
    addSharedKey: (accountKey, name) => dispatch(walletActions.addSharedKey(accountKey, name)),
    removeSharedKey: (accountKey) => dispatch(walletActions.removeSharedKey(accountKey)),
    showSuccess: (message) => dispatch(showSuccess(message)),
    showError: (message) => dispatch(showError(message)),
  })
)
export default class Multisig extends Component {
  static propTypes = {
    network: PropTypes.string.isRequired,
    walletId: PropTypes.string.isRequired,
    walletInitialized: PropTypes.bool.isRequired,
    walletM: PropTypes.number,
    walletN: PropTypes.number,
    accountKey: PropTypes.string.isRequired,
    walletKeys: PropTypes.array.isRequired,
    walletKeysNames: PropTypes.object.isRequired,
    fetchWallet: PropTypes.func.isRequired,
    addSharedKey: PropTypes.func.isRequired,
    removeSharedKey: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

  removeKey = async (accountKey) => {
    try {
      await this.props.removeSharedKey(accountKey);
      await this.props.fetchWallet();
    } catch (e) {
      console.error(e)
      this.props.showError(e.message);
    }
  }

  onLoadTx = async () => {
    const {
      filePaths: [filepath],
    } = await dialog.showOpenDialog({
      title: "Open a handshake transaction file",
      properties: ["openFile"],
      filters: [
        {
          name: "Handshake Transaction",
          extensions: ["json"],
        },
      ],
    });

    if (!filepath) return;

    fs.readFile(filepath, 'utf-8', async (err, data) => {
      if(err) {
        this.props.showError('Could not open transaction file: ' + err);
        return;
      }

      try {
        const {mtx, metadata} = parseTxFile(data);
        await walletClient.loadTransaction(
          mtx.getJSON(this.props.network),
          metadata
        );
      } catch (e) {
        if (e.message !== 'Cancelled.') {
          this.props.showError(e.message);
          console.error(e);
        }
      }
    });
  }

  render() {
    const {t} = this.context;
    const {walletId, walletInitialized, walletM, walletN, accountKey} = this.props;

    return (
      <div>
        <div className="multisig__header">
          <span>{t('multisigPolicy', walletM, walletN)}</span>
          {walletInitialized &&
            <button onClick={this.onLoadTx}>
              {t('multisigLoadTx')}
            </button>
          }
        </div>

        {this.renderNotInitAlert()}

        <Table className="multisig__signers-table">
          <HeaderRow>
            <HeaderItem>{t('signer')}</HeaderItem>
            <HeaderItem>{t('multisigAccountKey')}</HeaderItem>
            <HeaderItem>{t('multisigActions')}</HeaderItem>
          </HeaderRow>

          <TableRow>
            <TableItem>{walletId} ({t('me')})</TableItem>
            <TableItem>
              {accountKey}
            </TableItem>
            <TableItem>
              <CopyButton content={accountKey} />
            </TableItem>
          </TableRow>

          {this.renderOtherSigners()}

        </Table>
      </div>
    );
  }

  renderNotInitAlert() {
    const {t} = this.context;
    const {walletInitialized} = this.props;

    if (walletInitialized) return null;

    return (
      <Alert
        type="warning"
        className="multisig__not-init-alert"
        message={t('multisigSetupAlert')}
      />
    );
  }

  renderOtherSigners() {
    const {walletN, walletKeys, walletKeysNames, walletInitialized} = this.props;
    const num = walletN - 1; // Our own key is already there
    const keys = walletKeys;
    const rows = [];

    for (let i = 0; i < num; i++) {
      let key = keys[i];

      if (key) {
        rows.push(
          <TableRow key={i}>
            <TableItem>
              {walletKeysNames[key] || `${t('signer')} #${i+2}`}
            </TableItem>
            <TableItem>
              {key}
            </TableItem>
            <TableItem>
              {!walletInitialized &&
                <button
                  className="btn-danger"
                  onClick={() => this.removeKey(key)}
                >
                  {t('remove')}
                </button>
              }
              <CopyButton content={key} />
            </TableItem>
          </TableRow>
        );
      } else {
        rows.push(
          <KeyInputRow
            key={i}
            fetchWallet={this.props.fetchWallet}
            addSharedKey={this.props.addSharedKey}
            showError={this.props.showError}
            showSuccess={this.props.showSuccess}
            walletN={this.props.walletN}
            walletKeys={this.props.walletKeys}
          />
        );
      }
    }

    return rows;
  }
}

class KeyInputRow extends Component {
  static propTypes = {
    fetchWallet: PropTypes.func.isRequired,
    addSharedKey: PropTypes.func.isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    walletN: PropTypes.number.isRequired,
    walletKeys: PropTypes.array.isRequired,
  }

  state = {
    name: '',
    accountKey: '',
  }

  addKey = async () => {
    const {t} = this.context;
    const {walletN, walletKeys} = this.props;
    const {name, accountKey} = this.state;

    if (!this.isValid()) {
      return;
    }

    try {
      // N - 1 (for us) - num(other added keys as of now)
      const remainingKeys = (walletN - 1 - walletKeys.length);
      const {addedKey} = await this.props.addSharedKey(accountKey, name);
      this.setState({name: '', accountKey: ''});
      await this.props.fetchWallet();
      if (remainingKeys === 1 && addedKey) {
        // All keys added, start wallet rescan.
        walletClient.rescan(0);
        this.props.showSuccess(t('multisigSetupSuccess'));
      }
    } catch (e) {
      console.error(e)
      if (e.code === 'ERR_ENCODING') {
        this.props.showError(t('multisigAccountKeyInvalid'));
      } else {
        this.props.showError(e.message);
      }
    }
  }

  onChange = (name) => (e) => {
    this.setState({
      [name]: e.target.value.trim(),
    });
  };

  isValid = () => {
    const {network} = this.props;
    const {name, accountKey} = this.state;

    if (!name || !accountKey || !isBase58(accountKey, network)) {
      return false;
    }

    return true;
  }

  render() {
    const {t} = this.context;
    const {name, accountKey} = this.state;
    return (
      <TableRow>
        <TableItem>
          <div className="input-container">
            <input
              type="text"
              placeholder={t('nickname')}
              spellCheck="false"
              value={name}
              onChange={this.onChange('name')}
            />
          </div>
        </TableItem>
        <TableItem>
          <div className="input-container">
            <input
              type="text"
              placeholder="xpub..."
              spellCheck="false"
              value={accountKey}
              onChange={this.onChange('accountKey')}
            />
          </div>
        </TableItem>
        <TableItem>
          <button
            className="btn-secondary"
            onClick={this.addKey}
            disabled={!this.isValid()}
          >
            {t('save')}
          </button>
        </TableItem>
      </TableRow>
    );
  }
}
