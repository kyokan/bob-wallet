import React, { Component } from "react";
import {MiniModal} from "../../components/Modal/MiniModal";
import {clientStub} from "../../background/node/client";
import c from "classnames";
import {connect} from "react-redux";
import {withRouter} from "react-router-dom";
import Alert from "../../components/Alert";
import dbClient from "../../utils/dbClient";
const nodeClient = clientStub(() => require('electron').ipcRenderer);
const {dialog} = require('electron').remote;


@withRouter
@connect(
  null,
  null,
)
export default class ChangeDirectoryModal extends Component {
  state = {
    directory: '',
    errorMessage: '',
    saving: false,
  };

  async componentDidMount() {
    const directory = await nodeClient.getDir();
    const userDir = await dbClient.getUserDir();
    this.setState({
      originalDirectory: directory,
      directory,
      userDir,
    });
  }

  reset = async () => {
    const {originalDirectory} = this.state;
    this.setState({
      originalDirectory,
      directory: originalDirectory,
    });
  };

  saveDir = async () => {
    const {directory} = this.state;
    this.setState({ saving: true });
    try {
      await nodeClient.setNodeDir(directory);
    } catch (e) {
      this.setState({
        errorMessage: e.message,
      });
    }

    this.setState({
      saving: false,
      directory,
      originalDirectory: directory,
    });
  };

  pickDirectory = async () => {
    let savePath = dialog.showOpenDialogSync({
      properties: ["openDirectory", "promptToCreate", "createDirectory"],
    });

    this.setState({ directory: savePath[0] });
  };

  render() {
    const { errorMessage, directory, originalDirectory, userDir, saving } = this.state;

    return (
      <MiniModal
        closeRoute="/settings/connection"
        title="Change HSD Directory"
      >
        <Alert type="warning">
          This will only change your hsd home directory. Your other data, such as user setting and wallet data, will still be saved in <i>{userDir}</i>. <b>Please restart Bob for new setting to take effect.</b>
        </Alert>
        <div className="settings__input-row">
          <div className="settings__input-title">
            Home Directory
            <a onClick={this.pickDirectory}>
              Pick Directory
            </a>
          </div>
          <input
            type="text"
            className="settings__input"
            value={directory}
            onChange={e => this.setState({
              directory: e.target.value,
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
            onClick={this.reset}
            disabled={originalDirectory === directory}
          >
            Cancel
          </button>
          <button
            className={c('settings__btn', {
              'settings__btn--confirm': saving,
            })}
            onClick={this.saveDir}
            disabled={errorMessage || originalDirectory === directory}
          >
            Change Directory
          </button>
        </div>
      </MiniModal>
    )
  }
}
