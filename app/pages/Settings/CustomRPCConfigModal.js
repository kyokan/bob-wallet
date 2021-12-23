import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import MiniModal from "../../components/Modal/MiniModal";
import {withRouter} from "react-router-dom";
import {connect} from "react-redux";
import * as nodeActions from "../../ducks/node";
import * as walletActions from '../../ducks/walletActions';
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
  (state) => ({
    walletNetwork: state.wallet.network,
  }),
  dispatch => ({
    setCustomRPCStatus: isConnected => dispatch(setCustomRPCStatus(isConnected)),
    testRPC: (walletNetwork) => dispatch(nodeActions.testRPC(walletNetwork)),
    fetchWallet: () => dispatch(walletActions.fetchWallet()),
  }),
)
export default class CustomRPCConfigModal extends Component {
  static propTypes = {
    walletNetwork: PropTypes.string.isRequired,
    setCustomRPCStatus: PropTypes.func.isRequired,
    fetchWallet: PropTypes.func.isRequired,
  };

  state = {
    protocol: 'http',
    host: '',
    pathname: '',
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

    const {rpcPort} = Network.get(this.props.walletNetwork);

    this.setState({
      protocol: conn.protocol || 'http',
      apiKey: conn.apiKey,
      port: conn.port || rpcPort,
      host: conn.host || '127.0.0.1',
      pathname: conn.pathname,
    });
  }

  saveCustomRPC = async () => {
    const valid = await this.validate();

    if (!valid) {
     return;
    }

    const {
      apiKey,
      host,
      port,
      pathname,
      protocol,
    } = this.state;
    const conn = await connClient.getCustomRPC();

    // Set everything but don't switch connection yet
    await connClient.setConnection({
      type: ConnectionTypes.TEST,
      host,
      port,
      networkType: this.props.walletNetwork,
      apiKey,
      pathname,
      protocol,
    });

    // Test first
    const [status, data] = await this.props.testRPC(this.props.walletNetwork);

    if (!status) {
      this.setState({
        errorMessage: data,
      });
      return;
    }

    try {
      // OK
      await connClient.setConnectionType(ConnectionTypes.Custom);
      await nodeClient.reset();

      if (!await nodeClient.getInfo()) {
        throw new Error('cannot get node info');
      }

      await this.props.setCustomRPCStatus(true);
      this.props.history.push('/settings/connection');
    } catch (e) {
      await this.props.setCustomRPCStatus(false);
      await this.props.fetchWallet();
      this.setState({
        errorMessage: e.message,
      });
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
      apiKey,
      port,
      protocol,
    } = this.state;

    let {errorMessage} = this.state;
    if (!errorMessage && this.isDangerousURL())
      errorMessage = 'Remote connection over HTTP is prohibited.';
    

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
              { label: 'https', value: 'https' },
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
            onChange={e => this.setState({
              pathname: e.target.value,
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
            onChange={e => this.setState({
              port: e.target.value,
              errorMessage: '',
            })}
          />
        </div>

        <div className="settings__input-row">
          <div className="settings__input-title">API Key</div>
          <input
            spellCheck={false}
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
          errorMessage && (
            <div className="rpc-modal-warning">
              {errorMessage}
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
            className={"settings__btn settings__btn--confirm"}
            onClick={this.saveCustomRPC}
            disabled={errorMessage}
          >
            Save
          </button>
        </div>
      </MiniModal>
    );
  }
}
