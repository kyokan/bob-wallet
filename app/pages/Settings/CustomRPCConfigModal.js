import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import MiniModal from "../../components/Modal/MiniModal";
import {withRouter} from "react-router-dom";
import {connect} from "react-redux";
import * as nodeActions from "../../ducks/node";
import {setCustomRPCStatus} from "../../ducks/node";
import {ConnectionTypes} from "../../background/connections/service";
import {clientStub as cClientStub} from "../../background/connections/client";
import {clientStub as nClientStub} from "../../background/node/client";
import NetworkPicker from "../NetworkPicker";
const Network = require('hsd/lib/protocol/network');
import './custom-rpc.scss';
import Dropdown from "../../components/Dropdown";

const connClient = cClientStub(() => require('electron').ipcRenderer);
const nodeClient = nClientStub(() => require('electron').ipcRenderer);

@withRouter
@connect(
  null,
  dispatch => ({
    changeCustomNetwork: (net) => dispatch(nodeActions.changeCustomNetwork(net)),
    setCustomRPCStatus: isConnected => dispatch(setCustomRPCStatus(isConnected)),
  }),
)
export default class CustomRPCConfigModal extends Component {
  static propTypes = {
    changeCustomNetwork: PropTypes.func.isRequired,
    setCustomRPCStatus: PropTypes.func.isRequired,
  };

  state = {
    protocol: 'http',
    host: '',
    pathname: '',
    networkType: 'main',
    port: '',
    apiKey: '',
    errorMessage: '',
  };

  componentDidMount() {
    (async () => {
      await this.fetchCustomRPC();
    })();
  }

  async fetchCustomRPC() {
    const conn = await connClient.getCustomRPC();

    this.setState({
      networkType: conn.networkType || 'main',
      protocol: conn.protocol || 'http',
      apiKey: conn.apiKey,
      port: conn.port,
      host: conn.host,
      pathname: conn.pathname,
    });
  }

  saveCustomRPC = async () => {
    const valid = await this.validate();

    if (!valid) {
     return;
    }

    if (!this.state.confirming && this.isDangerousURL()) {
      this.setState({
        confirming: true,
      });
      return;
    }

    const {
      networkType,
      apiKey,
      host,
      port,
      pathname,
      protocol,
    } = this.state;
    const conn = await connClient.getCustomRPC();

    await connClient.setConnection({
      type: ConnectionTypes.Custom,
      host,
      port,
      networkType: conn.networkType,
      apiKey,
      pathname,
      protocol,
    });

    this.props.history.push('/settings/connection');

    await this.props.changeCustomNetwork(networkType);

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
      const {protocol, host} = this.state;
      return (protocol === 'http' && !['127.0.0.1', 'localhost'].includes(host));
    } catch (e) {
      return false;
    }
  }

  getInputURL() {
    const {
      protocol,
      port,
      host,
      pathname,
    } = this.state;

    const portString = port ? `:${port}` : '';
    const pathString = (!pathname || pathname === '/')
      ? ''
      : pathname;

    const url = `${protocol}://${host}${portString}${pathString}`;

    new URL(url);

    return url;
  }

  validate() {
    const {
      port,
    } = this.state;

    try {
      this.getInputURL();
    } catch (e) {
      this.setState({
        errorMessage: e.message,
      });
      return false;
    }

    if (port && isNaN(Number(port))) {
      this.setState({
        errorMessage: 'Invalid port',
      });
      return false;
    }

    return true;
  }

  render() {
    const {
      host,
      pathname,
      networkType,
      apiKey,
      port,
      protocol,
      errorMessage,
    } = this.state;

    return (
      <MiniModal
        closeRoute="/settings/connection"
        title="Configure Custom RPC"
        centered
      >
        <div className="settings__input-row">
          <div className="settings__input-title">Protocol</div>
          <Dropdown
            className="network-picker custom-rpc__network-picker"
            items={[
              { label: 'http', value: 'http' },
              // { label: 'https', value: 'https' },
            ]}
            currentIndex={['http', 'https'].indexOf(protocol)}
            onChange={(value) => this.setState({
              protocol: value,
              errorMessage: '',
            })}
          />
        </div>

        <div className="settings__input-row">
          <div className="settings__input-title">Host</div>
          <input
            type="text"
            className="settings__input"
            value={host}
            placeholder={`127.0.0.1`}
            onChange={e => this.setState({
              host: e.target.value,
              errorMessage: '',
            })}
          />
        </div>

        <div className="settings__input-row">
          <div className="settings__input-title">Path</div>
          <input
            type="text"
            className="settings__input"
            value={pathname}
            placeholder={`/`}
            onChange={e => this.setState({
              pathname: e.target.value,
              errorMessage: '',
            })}
          />
        </div>

        <div className="settings__input-row">
          <div className="settings__input-title">Network Type</div>
          <NetworkPicker
            className="custom-rpc__network-picker"
            currentNetwork={networkType}
            onNetworkChange={(net) => this.setState({
              networkType: net,
              port:  Network.get(net).rpcPort,
              errorMessage: '',
            })}
          />
        </div>

        <div className="settings__input-row">
          <div className="settings__input-title">Port</div>
          <input
            type="text"
            className="settings__input"
            value={port}
            placeholder={`12037`}
            onChange={e => this.setState({
              port: e.target.value,
              errorMessage: '',
            })}
          />
        </div>

        <div className="settings__input-row">
          <div className="settings__input-title">API Key</div>
          <input
            type="text"
            className="settings__input"
            value={apiKey}
            onChange={e => this.setState({
              apiKey: e.target.value,
              errorMessage: '',
            })}
          />
        </div>
        {
          !errorMessage && this.state.confirming && (
            <div className="rpc-modal-warning">
              Remote connection over HTTP is not recommended. Are you sure you want to continue?
            </div>
          )
        }

        {
          errorMessage && (
            <div className="rpc-modal-warning">
              {errorMessage}`
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
            disabled={errorMessage}
          >
            {this.state.confirming ? 'Confirm' : 'Save'}
          </button>
        </div>
      </MiniModal>
    );
  }
}
