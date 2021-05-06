import MiniModal from "../../components/Modal/MiniModal";
import React, {Component} from "react";
import PropTypes from "prop-types";
import crypto from "crypto";
import Alert from "../../components/Alert";

export default class APIKeyModal extends Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    closeRoute: PropTypes.string.isRequired,
    apiKey: PropTypes.string.isRequired,
    updateAPIKey: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      apiKey: props.apiKey,
    };
  }

  generateNewKey = async() => {
    this.setState({
      apiKey: crypto.randomBytes(20).toString('hex'),
    });
  };

  updateAPIKey = async () => {
    const {apiKey} = this.state;
    this.setState({ saving: true });
    try {
      await this.props.updateAPIKey(apiKey);
    } catch (e) {
      this.setState({
        errorMessage: e.message,
      });
    }

    this.setState({
      saving: false,
    });
  };

  render() {
    const {
      title,
      closeRoute,
      apiKey,
    } = this.props;

    return (
      <MiniModal
        closeRoute={closeRoute}
        title={title}
      >
        <Alert type="warning">
          API Key will only take effect after you restart Bob.
        </Alert>
        <div className="settings__input-row">
          <div className="settings__input-title">
            API Key
            <a onClick={this.generateNewKey}>
              Generate New key
            </a>
          </div>
          <input
            type="text"
            className="settings__input"
            value={this.state.apiKey}
            onChange={e => this.setState({ apiKey: e.target.value })}
            onFocus={e => e.target.select()}
          />
        </div>
        <div className="settings__row settings__row--centered">
          <button
            className="settings__secondary-btn"
            onClick={() => this.setState({ apiKey: apiKey })}
            disabled={apiKey === this.state.apiKey || this.state.saving}
          >
            Cancel
          </button>
          <button
            className="settings__btn"
            onClick={this.updateAPIKey}
            disabled={apiKey === this.state.apiKey || this.state.saving}
          >
            Update
          </button>
        </div>
      </MiniModal>
    );
  }
}
