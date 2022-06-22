import MiniModal from "../../components/Modal/MiniModal";
import React, {Component} from "react";
import {connect} from "react-redux";
import {withRouter} from "react-router-dom";
import PropTypes from "prop-types";
import crypto from "crypto";
import Alert from "../../components/Alert";
import {I18nContext} from "../../utils/i18n";
import * as nodeActions from '../../ducks/node';

@withRouter
@connect(
  (state) => ({}),
  dispatch => ({
    stopNode: () => dispatch(nodeActions.stop()),
    startNode: () => dispatch(nodeActions.start()),
  }),
)
export default class APIKeyModal extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired
    }).isRequired,
    stopNode: PropTypes.func.isRequired,
    startNode: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    closeRoute: PropTypes.string.isRequired,
    apiKey: PropTypes.string.isRequired,
    updateAPIKey: PropTypes.func.isRequired,
  };

  static contextType = I18nContext;

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

    await this.props.stopNode();
    await this.props.startNode();

    this.setState({
      saving: false,
    });

    this.props.history.goBack();
  };

  render() {
    const {
      title,
      closeRoute,
      apiKey,
    } = this.props;

    const {t} = this.context;

    return (
      <MiniModal
        closeRoute={closeRoute}
        title={title}
      >
        <div className="settings__input-row">
          <div className="settings__input-title">
            {t('apiKey')}
            <a onClick={this.generateNewKey}>
              {t('generateNewKey')}
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
            {t('cancel')}
          </button>
          <button
            className="settings__btn"
            onClick={this.updateAPIKey}
            disabled={apiKey === this.state.apiKey || this.state.saving}
          >
            {t('update')}
          </button>
        </div>
      </MiniModal>
    );
  }
}
