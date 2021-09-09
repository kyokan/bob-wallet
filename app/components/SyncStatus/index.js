import React, { Component } from "react";
import { withRouter } from "react-router-dom";
import PropTypes from "prop-types";
import c from "classnames";
import { connect } from "react-redux";
import "./sync-status.scss";

@withRouter
@connect((state) => {
  const {
    chain,
    isRunning,
    isCustomRPCConnected,
    isChangingNodeStatus,
    isTestingCustomRPC,
  } = state.node;
  const { progress } = chain || {};

  return {
    isRunning,
    isCustomRPCConnected,
    isChangingNodeStatus,
    isTestingCustomRPC,
    isSynchronizing: isRunning && progress < 1,
    isSynchronized: isRunning && progress === 1,
    progress,
    walletSync: state.wallet.walletSync,
    walletHeight: state.wallet.walletHeight,
    chainHeight: state.node.chain.height,
  };
})
class SyncStatus extends Component {
  static propTypes = {
    isRunning: PropTypes.bool.isRequired,
    isCustomRPCConnected: PropTypes.bool.isRequired,
    isSynchronizing: PropTypes.bool.isRequired,
    isSynchronized: PropTypes.bool.isRequired,
    isChangingNodeStatus: PropTypes.bool.isRequired,
    isTestingCustomRPC: PropTypes.bool.isRequired,
    walletSync: PropTypes.bool.isRequired,
    walletHeight: PropTypes.number.isRequired,
    chainHeight: PropTypes.number.isRequired,
  };

  render() {
    const {
      isSynchronized,
      isSynchronizing,
      isChangingNodeStatus,
      isTestingCustomRPC,
      isRunning,
      isCustomRPCConnected,
      walletSync,
      progress,
    } = this.props;

    return (
      <React.Fragment>
        <div
          className={c("sync-status", {
            "sync-status--success": isSynchronized,
            "sync-status--failure": !isRunning,
            "sync-status--loading":
              walletSync ||
              isChangingNodeStatus ||
              isTestingCustomRPC ||
              isSynchronizing ||
              progress < 1,
          })}
        >
          {this.getSyncText()}
        </div>
      </React.Fragment>
    );
  }

  getSyncText() {
    const {
      isSynchronized,
      isSynchronizing,
      progress,
      isRunning,
      isCustomRPCConnected,
      isChangingNodeStatus,
      isTestingCustomRPC,
      walletSync,
      walletHeight,
      chainHeight,
    } = this.props;

    if (isSynchronizing) {
      return 'Synchronizing' +
             `${isCustomRPCConnected ? ' from RPC' : ''}... ` +
             `${progress ? "(" + (progress * 100).toFixed(2) + "%)" : ""}`;
    }

    if (walletSync) {
      return 'Rescanning' +
             `${isCustomRPCConnected ? ' from RPC' : ''}... ` +
             `(${Math.floor((walletHeight * 100) / chainHeight)}%)`;
    }

    if (isSynchronized) {
      return 'Synchronized' +
             `${isCustomRPCConnected ? ' from RPC' : ''}`;
    }

    if (isChangingNodeStatus || isTestingCustomRPC) {
      return "Please wait...";
    }

    return "No connection";
  }
}

export default SyncStatus;
