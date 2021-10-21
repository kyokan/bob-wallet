import React, { Component } from 'react';
import MiniModal from '../../components/Modal/MiniModal.js';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {rescanFillByName} from "../../ducks/exchange";

class RescanFillsModal extends Component {

  static propTypes = {
    rescanFillByName: PropTypes.func.isRequired,
  };

  state = {
    name: '',
    isRescanningFills: false,
    errorMessage: '',
  };

  onRescanFill = async () => {
    const { name, isRescanningFills } = this.state;

    if (!name || isRescanningFills) return;

    this.setState({ isRescanningFills: true });

    try {
      await this.props.rescanFillByName(name);
    } catch (e) {
      this.setState({ errorMessage: e.message });
    }

    this.setState({ isRescanningFills: false });
  };

  render() {
    const { name, isRescanningFills } = this.state;
    const { onClose } = this.props;

    return (
      <MiniModal title="Rescan Fills" onClose={onClose}>
        <div className="exchange__place-listing-modal">
          <p>
            Please enter the name you would like to scan for pending fills.
          </p>
          <div className="exchange__label">Name:</div>
          <div className="exchange__input">
            <div className="box-input">
              <input
                type="text"
                value={name}
                onChange={e => this.setState({ name: e.target.value })}
              />
            </div>
          </div>
          <div className="error-message">{this.state.errorMessage}</div>
          <div className="place-bid-modal__buttons">
            <button
              className="extension_secondary_button"
              onClick={isRescanningFills ? null : onClose}
              disabled={isRescanningFills}
            >
              Cancel
            </button>

            <button
              className="extension_cta_button"
              disabled={isRescanningFills}
              onClick={this.onRescanFill}
            >
              {isRescanningFills ? 'Loading...' : 'Place Listing'}
            </button>
          </div>
        </div>
      </MiniModal>
    );
  }
}

export default connect(
  null,
  (dispatch) => ({
    rescanFillByName: (name) => dispatch(rescanFillByName(name)),
  }),
)(RescanFillsModal);
