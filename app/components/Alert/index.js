import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './alert.scss';

export default class Alert extends Component {
  static propTypes = {
    type: PropTypes.oneOf([
      'error',
      'success'
    ]).isRequired,
    message: PropTypes.string.isRequired
  };

  render() {
    if (!this.props.message) {
      return null;
    }

    const name = `alert alert--${this.props.type}`;

    return (
      <div className={name}>
        {this.props.message}
      </div>
    );
  }
}
