import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './header.scss';

export default class Header extends Component {
  static propTypes = {
    blockHeight: PropTypes.number.isRequired,
    status: PropTypes.string.isRequired,
  };

  static defaultProps = {
    blockHeight: 1234,
  };

  render() {
    const { blockHeight } = this.props;

    return (
      <div className="header">
        <div className="header__content">
          <div className="header__title">
            Handshake Wallet
          </div>
          <div className="header__block-height">
            <div className="header__block-height-label">
              Current Height:
            </div>
            <div className="header__block-height-text">
              {blockHeight}
            </div>
          </div>
          <div className="header__status">
            Synced
          </div>
        </div>
      </div>
    );
  }
}
