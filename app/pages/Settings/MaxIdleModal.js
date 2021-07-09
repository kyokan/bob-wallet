import React, { Component } from "react";
import PropTypes from "prop-types";
import { withRouter } from "react-router-dom";
import { connect } from "react-redux";
import MiniModal from "../../components/Modal/MiniModal";
import { setMaxIdle } from "../../ducks/walletActions";
import "./max-idle-modal.scss";

@withRouter
@connect(
  (state) => ({
    maxIdle: state.wallet.maxIdle,
  }),
  (dispatch) => ({
    setMaxIdle: (maxIdle) => dispatch(setMaxIdle(maxIdle)),
  })
)
export default class MaxIdleModal extends Component {
  static propTypes = {
    maxIdle: PropTypes.number.isRequired,
    setMaxIdle: PropTypes.func.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      maxIdle: props.maxIdle,
    };
  }

  onUpdateMaxIdle = async () => {
    try {
      await this.props.setMaxIdle(this.state.maxIdle);
      this.props.history.push("/settings");
    } catch (e) {
      console.error(e);
    }
  };

  render() {
    return (
      <MiniModal title="Change idle timeout" closeRoute="/settings" centered>
        <div className="max-idle-modal__instructions">
          Enter the time of inactivity after which the wallet should
          automatically lock (0 to disable auto-lock).
        </div>
        <div className="max-idle-modal__input">
          <input
            type="number"
            value={this.state.maxIdle}
            onChange={(e) => this.setState({ maxIdle: e.target.value >>> 0 })}
            placeholder="5"
            min="0"
            autoFocus
          />{" "}
          minutes
        </div>
        <button
          className="max-idle-modal__submit"
          onClick={this.onUpdateMaxIdle}
        >
          Change timeout
        </button>
      </MiniModal>
    );
  }
}
