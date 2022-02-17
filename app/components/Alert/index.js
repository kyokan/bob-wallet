import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './alert.scss';

export default class Alert extends Component {
  static propTypes = {
    type: PropTypes.oneOf([
      'error',
      'warning',
      'success',
      'info'
    ]).isRequired,
    message: PropTypes.string,
    children: PropTypes.node,
    style: PropTypes.object,
  };

  render() {
    const { message, type, children, style} = this.props;

    if (!message && !children) {
      return null;
    }

    const name = `alert alert--${type}`;

    return (
      <div className={name} style={style}>
        {children || message}
      </div>
    );
  }
}
