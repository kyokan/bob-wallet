import React, { Component } from "react";
import { withRouter } from "react-router-dom";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import NetworkPicker from "../NetworkPicker";
import SyncStatus from "../../components/SyncStatus";
import * as nodeActions from "../../ducks/node";
import { ConnectionTypes } from "../../background/connections/service";
import { clientStub as cClientStub } from "../../background/connections/client";
const connClient = cClientStub(() => require("electron").ipcRenderer);

@withRouter
@connect(
  (state) => ({
    isRunning: state.node.isRunning,
  }),
  (dispatch) => ({
    changeNetwork: (network) =>
      dispatch(nodeActions.changeCustomNetwork(network)),
  })
)
export default class AppHeader extends Component {
  static propTypes = {
    isRunning: PropTypes.bool.isRequired,
    isMainMenu: PropTypes.bool.isRequired,
  };

  state = {
    isLoading: true,
    customRPCNetworkType: "",
  };

  async componentDidMount() {
    this.setState({ isLoading: true });
    const { type } = await connClient.getConnection();

    if (type === ConnectionTypes.Custom) {
      await this.fetchCustomRPC();
    } else {
      this.setState({ customRPCNetworkType: "" });
    }
  }

  async fetchCustomRPC() {
    const conn = await connClient.getCustomRPC();
    this.setState({
      customRPCNetworkType: conn.networkType || "main",
    });
  }

  render() {
    const { isMainMenu } = this.props;

    return (
      <div className="app__header">
        <div className="app__logo" />
        <div className="app__network-picker-wrapper">
          <SyncStatus />
          {isMainMenu ? this.renderNetworkPicker() : this.renderReturnToMenu()}
        </div>
      </div>
    );
  }

  renderReturnToMenu() {
    return (
      <div className="app__cancel" onClick={() => this.props.history.push("/")}>
        Return to Menu
      </div>
    );
  }

  renderNetworkPicker() {
    const { isRunning } = this.props;
    const { customRPCNetworkType } = this.state;

    if (isRunning) {
      return <NetworkPicker />;
    }

    return (
      <NetworkPicker
        currentNetwork={customRPCNetworkType}
        onNetworkChange={async (net) => {
          this.setState({ customRPCNetworkType: net });
          await this.props.changeNetwork(net);
        }}
      />
    );
  }
}
