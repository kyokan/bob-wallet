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
    host: '',
    port: '',
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
      host: conn.host,
      port: conn.port,
      networkType: conn.networkType,
      apiKey: conn.apiKey,
    });
  }

  saveCustomRPC = async () => {
    const { host, port, networkType, apiKey } = this.state;
    await connClient.setConnection({
      type: ConnectionTypes.Custom,
      host,
      port,
      networkType,
      apiKey,
    });

    this.props.history.push('/settings/connection');

    await this.props.stop();

    try {
      await nodeClient.getInfo();
      await this.props.setCustomRPCStatus(true);
    } catch (e) {
      await this.props.setCustomRPCStatus(false);
    }
  };

  render() {
    const { host, port, networkType, apiKey } = this.state;

    return (
      <MiniModal
        closeRoute="/settings/connection"
        title="Configure Custom RPC"
        centered
      >
        <div className="settings__input-row">
          <div className="settings__input-title">Network Type</div>
          <Dropdown
            items={networks}
            currentIndex={networksIndices[networkType]}
            onChange={index => {
              this.setState({
                networkType: indicesNetworks[index],
              });
            }}
          />
        </div>
        <div className="settings__input-row">
          <div className="settings__input-title">Host</div>
          <input
            type="text"
            className="settings__input"
            value={host}
            onChange={e => this.setState({ host: e.target.value })}
          />
        </div>
        <div className="settings__input-row">
          <div className="settings__input-title">Port</div>
          <input
            type="text"
            className="settings__input"
            value={port}
            onChange={e => this.setState({ port: e.target.value })}
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
        <div className="settings__row settings__row--centered">
          <button
            className="settings__secondary-btn"
            onClick={() => this.props.history.push('/settings/connection')}
          >
            Cancel
          </button>
          <button
            className="settings__btn"
            onClick={this.saveCustomRPC}
          >
            Save
          </button>
        </div>
      </MiniModal>
    );
  }
}
