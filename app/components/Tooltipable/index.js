import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './tooltipable.scss';

export default class Tooltipable extends Component {
  static propTypes = {
    children: PropTypes.node,
    tooltipContent: PropTypes.node,
    className: PropTypes.string,
  };

  static defaultProps = {
    className: '',
  };

  render() {
    const { children, tooltipContent, className } = this.props;

    return (
      <div className={`tooltipable ${className}`}>
        {children}
        <div className='tooltipable__tooltip'>
          {tooltipContent}
        </div>
      </div>
    )
  }
}
