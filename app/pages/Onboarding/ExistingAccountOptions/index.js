import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
// import classNames from 'classnames';
import './existing.scss';

const NONE = 0;
const CONNECT_LEDGER = 1;
const IMPORT_SEED = 2;

@withRouter
class ExistingAccountOptions extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired
    })
  };

  state = {
    hovered: NONE
  };

  getTip() {
    switch (this.state.hovered) {
      case IMPORT_SEED:
        return 'A 24 word secret phrase that was given to you when you generated a previous Handshake wallet (e.g. developer faucet).';
      case CONNECT_LEDGER:
        return 'A small device that generates and holds onto your private key. Transactions are signed directly on the device.';
      case NONE:
      default:
        return '';
    }
  }

  render() {
    return (
      <div className="existing-options">
        <div className="existing-options__header">
          <i
            className="arrow left"
            onClick={() => this.props.history.push('/funding-options')}
          />
        </div>
        <div className="existing-options__content">
          <div className="existing-options__content__title">
            How would you like to access your Handshake wallet?
          </div>
          <div
            className="existing-options__content__option"
            onMouseEnter={() => this.setState({ hovered: IMPORT_SEED })}
            onMouseLeave={() => this.setState({ hovered: NONE })}
            onClick={() => this.props.history.push('/import-seed')}
          >
            <div className="existing-options__content__option__title">
              Import Your Seed Phrase
            </div>
          </div>
        </div>
        <div className="existing-options__footer">
          <div className="existing-options__footer__tip">{this.getTip()}</div>
        </div>
      </div>
    );
  }
}

export default ExistingAccountOptions;
