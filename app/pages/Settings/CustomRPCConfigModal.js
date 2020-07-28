import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import MiniModal from "../../components/Modal/MiniModal";
import Dropdown from "../../components/Dropdown";
import {indicesNetworks, networks, networksIndices} from "../NetworkPicker";
import {withRouter} from "react-router-dom";
import {connect} from "react-redux";
import * as nodeActions from "../../ducks/node";
import {setCustomRPCStatus} from "../../ducks/node";
import {ConnectionTypes} from "../../background/connections/service";
import {clientStub as cClientStub} from "../../background/connections/client";
import {clientStub as nClientStub} from "../../background/node/client";

const connClient = cClientStub(() => require('electron').ipcRenderer);
const nodeClient = nClientStub(() => require('electron').ipcRenderer);

@withRouter
@connect(
  null,
  dispatch => ({
    stop: () => dispatch(nodeActions.stop()),
    setCustomRPCStatus: isConnected => dispatch(setCustomRPCStatus(isConnected)),
  }),
)
export default class CustomRPCConfigModal extends Component {
  static propTypes = {
    stop: PropTypes.func.isRequired,
    setCustomRPCStatus: PropTypes.func.isRequired,
  };

  state = {
    url: '',
    networkType: '',
    apiKey: '',
  };

  componentDidMount() {
    (async () => {
      await this.fetchCustomRPC();
    })();
  }

  async fetchCustomRPC() {
    const conn = await connClient.getCustomRPC();
    this.setState({
      url: conn.url,
      networkType: conn.networkType,
      apiKey: conn.apiKey,
    });
  }

  saveCustomRPC = async () => {
    if (!this.state.confirming && this.isDangerousURL()) {
      this.setState({
        confirming: true,
      });
      return;
    }

    const { url, networkType, apiKey } = this.state;
    await connClient.setConnection({
      type: ConnectionTypes.Custom,
      url,
      networkType,
      apiKey,
    });

    this.props.history.push('/settings/connection');

    await this.props.stop();

    try {
      if (!await nodeClient.getInfo()) {
        throw new Error('cannot get node info');
      }
      await this.props.setCustomRPCStatus(true);
    } catch (e) {
      await this.props.setCustomRPCStatus(false);
    }
  };

  isDangerousURL() {
    try {
      const { url } = this.state;
      const {protocol, hostname} = new URL(url);
      console.log(protocol, hostname, protocol === 'http:' && !['127.0.0.1', 'localhost'].includes(hostname))
      return (protocol === 'http:' && !['127.0.0.1', 'localhost'].includes(hostname));
    } catch (e) {
      return false;
    }
  }

  render() {
    const { url, networkType, apiKey } = this.state;

    return (
      <MiniModal
        closeRoute="/settings/connection"
        title="Configure Custom RPC"
        centered
      >
        <div className="settings__input-row">
          <div className="settings__input-title">URL</div>
          <input
            type="text"
            className="settings__input"
            value={url}
            placeholder="http://127.0.0.1:12037"
            onChange={e => this.setState({ url: e.target.value })}
          />
        </div>
        <div className="settings__input-row">
          <div className="settings__input-title">API Key</div>
          <input
            type="text"
            className="settings__input"
            value={apiKey}
            onChange={e => this.setState({ apiKey: e.target.value })}
          />
        </div>
        {
          this.state.confirming && (
            <div className="rpc-modal-warning">
              Remote connection over HTTP is not recommended. Are you sure you want to continue?
            </div>
          )
        }
        <div className="settings__row settings__row--centered">
          <button
            className="settings__secondary-btn"
            onClick={() => this.props.history.push('/settings/connection')}
          >
            Cancel
          </button>
          <button
            className={c('settings__btn', {
              'settings__btn--confirm': this.state.confirming,
            })}
            onClick={this.saveCustomRPC}
          >
            {this.state.confirming ? 'Confirm' : 'Save'}
          </button>
        </div>
      </MiniModal>
    );
  }
}
