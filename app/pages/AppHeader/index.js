import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
import NetworkPicker from "../NetworkPicker";
import * as nodeActions from "../../ducks/node";
import {ConnectionTypes} from "../../background/connections/service";
import {clientStub as cClientStub} from "../../background/connections/client";
const connClient = cClientStub(() => require('electron').ipcRenderer);

@withRouter
@connect(
  (state) => ({
    isRunning: state.node.isRunning,
  }),
  (dispatch) => ({
    changeNetwork: (network) => dispatch(nodeActions.changeCustomNetwork(network)),
  }),
)
export default class AppHeader extends Component {
  static propTypes = {
    isRunning: PropTypes.bool.isRequired,
    isMainMenu: PropTypes.bool.isRequired,
  };

  state = {
    isLoading: true,
    customRPCNetworkType: '',
  };

  async componentDidMount() {
    this.setState({ isLoading: true });
    const {type} = await connClient.getConnection();

    if (type === ConnectionTypes.Custom) {
      await this.fetchCustomRPC();
    } else {
      this.setState({ customRPCNetworkType: '' })
    }
  }

  async fetchCustomRPC() {
    const conn = await connClient.getCustomRPC();
    this.setState({
      customRPCNetworkType: conn.networkType || 'main',
    });
  }

  render() {
    const {
      isRunning,
      isMainMenu,
      history: { push },
    } = this.props;

    const {
      customRPCNetworkType,
    } = this.state;

    if (!isMainMenu) {
      return (
        <div className="app__header">
          <div className="app__logo" />
          <div className="app__network-picker-wrapper">
            <div
              className="app__cancel"
              onClick={() => push('/')}
            >
              Return to Menu
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="app__header">
        <div className="app__logo" />
        <div className="app__network-picker-wrapper">
          {
            isRunning
              ? <NetworkPicker />
              : (
                <NetworkPicker
                  currentNetwork={customRPCNetworkType}
                  onNetworkChange={async (net) => {
                    this.setState({ customRPCNetworkType: net });
                    await this.props.changeNetwork(net);
                  }}
                />
              )
          }
        </div>
      </div>
    );
  }
}
