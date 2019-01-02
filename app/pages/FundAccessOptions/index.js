import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
// import { connect } from 'react-redux';
import PropTypes from 'prop-types';
// import classNames from 'classnames';
// import * as auctions.js from '../../../ducks/extension';
import './access.scss';

// @connect(
//   state => ({
//   }),
//   dispatch => ({
//   }),
// )
@withRouter
class FundAccessOptions extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func,
    }).isRequired,
  };

  render() {
    return (
      <div className="extension_primary_section funding-options">
        <div className="funding-options__header">
          <div className="funding-options__header__alice" />
          <div className="funding-options__header__the-cat" />
        </div>
        <div className="funding-options__content">
          <div className="funding-options__content__title">
            Allison Animates the Web
          </div>
          <div className="funding-options__content__body-text">
            Take control of your Handshake coins. browse Handshake websites, and
            auction domains.
          </div>
        </div>
        <div className="funding-options__footer">
          <button
            type="button"
            className="funding-options__footer__primary-btn"
            onClick={() => this.props.history.push('/new-wallet')}
          >
            Create a new wallet
          </button>
          <button
            type="button"
            className="funding-options__footer__secondary-btn"
            onClick={() => this.props.history.push('/existing-options')}
          >
            I already have a wallet
          </button>
        </div>
      </div>
    );
  }
}

export default FundAccessOptions;
