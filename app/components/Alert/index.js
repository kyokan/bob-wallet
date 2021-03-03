import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './alert.scss';

export default class Alert extends Component {
  static propTypes = {
    type: PropTypes.oneOf([
      'error',
      'warning',
      'success'
    ]).isRequired,
    message: PropTypes.string,
    children: PropTypes.node,
  };

  render() {
    const { message, type, children} = this.props;

    if (!message && !children) {
      return null;
    }

    const name = `alert alert--${type}`;

    return (
      <div className={name}>
        {children || message}
      </div>
    );
  }
}
