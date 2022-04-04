import React, { Component, Fragment } from "react";
import PropTypes from "prop-types";
import { withRouter } from "react-router";
import { connect } from "react-redux";
import {clientStub as wClientStub} from "../../background/wallet/client";
import * as networks from "hsd/lib/protocol/networks";
import { clientStub as aClientStub } from "../../background/analytics/client";
import * as walletActions from "../../ducks/walletActions";
import { showError, showSuccess } from "../../ducks/notifications";
import * as nameActions from "../../ducks/names";
import * as nodeActions from "../../ducks/node";
import {HeaderItem, HeaderRow, Table, TableItem, TableRow} from "../../components/Table";
import CopyButton from "../../components/CopyButton";

// I'm getting pretty tired of creating brand new stylesheets
// for every single view!
import "../../components/NameClaimModal/name-claim-modal.scss";

const walletClient = wClientStub(() => require('electron').ipcRenderer);


@withRouter
@connect(
  (state) => ({
    accountInfo: state.wallet.accountInfo,
    wallet: state.wallet,
  }),
  (dispatch) => ({
    fetchWallet: () => dispatch(walletActions.fetchWallet()),
  })
)
export default class Multisig extends Component {
  static propTypes = {
    accountInfo: PropTypes.object.isRequired,
    wallet: PropTypes.object.isRequired,
    fetchWallet: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className="name-claim__claim-content">
        <div>
          Multisig wallet policy: {this.props.accountInfo.m}-of-{this.props.accountInfo.n}
        </div>
        <Table className="name-claim__claim-content__txt-table">
          <HeaderRow>
            <HeaderItem width="25%">Signer</HeaderItem>
            <HeaderItem>Account Key (xpub)</HeaderItem>
          </HeaderRow>

          <TableRow>
            <TableItem width="25%">{this.props.wallet.wid} (me)</TableItem>
            <TableItem className="wrap">
              {this.props.accountInfo.accountKey} <CopyButton content={this.props.accountInfo.accountKey} />
            </TableItem>
          </TableRow>

          {this.renderOtherSigners()}

        </Table>
      </div>
    );
  }

  renderOtherSigners() {
    const rows = this.props.accountInfo.n - 1; // Our own key is already there
    const keys = this.props.accountInfo.keys;
    const out = [];

    for (let i = 0; i < rows; i++) {
      let key = keys[i];

      if (!key) {
        key =
          <KeyInput
            fetchWallet={this.props.fetchWallet}
          />
      }

      out.push(
          <TableRow>
            <TableItem width="25%">Signer #{i+2}</TableItem>
            <TableItem>
              {key}
            </TableItem>
          </TableRow>
      );
    }

    return out;
  }
}

class KeyInput extends Component {
  static propTypes = {
    fetchWallet: PropTypes.func,
  }

  state = {
    errorMessage: null,
  }

  async addKey(xpub) {
    this.setState({errorMessage: null})
    try {
      await walletClient.addSharedKey('default', xpub); // account, xpub
      await this.props.fetchWallet();
    } catch (e) {console.log(e)
      this.setState({errorMessage: e.message});
    }
  }

  handleChange = () => {
    this.setState({errorMessage: null});
  }

  render() {
    return (
      <div>
        <input
          type="text"
          className="name-claim__name-input-group__input"
          onChange={this.handleChange}
          onKeyDown={e => e.key === 'Enter' && this.addKey(e.target.value)}
          placeholder="xpub..."
        />
        <div className="login_password_error">
          {this.state.errorMessage}
        </div>
      </div>
    );
  }
}
