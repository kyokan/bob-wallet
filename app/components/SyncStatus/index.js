import React, { Component } from "react";
import { withRouter } from "react-router-dom";
import PropTypes from "prop-types";
import c from "classnames";
import { connect } from "react-redux";
import "./sync-status.scss";
import {I18nContext} from "../../utils/i18n";

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
    rescanHeight: state.wallet.rescanHeight,
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
    rescanHeight: PropTypes.number,
    chainHeight: PropTypes.number.isRequired,
  };

  static contextType = I18nContext;

  render() {
    const {
      isSynchronized,
      isSynchronizing,
      isChangingNodeStatus,
      isTestingCustomRPC,
      isRunning,
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
      isCustomRPCConnected,
      isChangingNodeStatus,
      isTestingCustomRPC,
      walletSync,
      walletHeight,
      rescanHeight,
      chainHeight,
    } = this.props;

    const {t} = this.context;

    if (walletSync) {
      const percentText = Math.floor((walletHeight * 100) / rescanHeight);
      return isCustomRPCConnected
        ? `${t('rescanningFromRPC')}... (${percentText}%)`
        : `${t('rescanning')}... (${percentText}%)`;
    }

    if (isSynchronizing) {
      const progressText = progress ? "(" + (progress * 100).toFixed(2) + "%)" : "";
      return isCustomRPCConnected
        ? `${t('synchronizingFromRPC')}... ${progressText}`
        : `${t('synchronizing')}... ${progressText}`;
    }

    if (isSynchronized) {
      return isCustomRPCConnected
        ? t('synchronizedFromRPC')
        : t('synchronized');
    }

    if (isChangingNodeStatus || isTestingCustomRPC) {
      return t('pleaseWait');
    }

    return t('noConnection');
  }
}

export default SyncStatus;
