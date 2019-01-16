import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './tooltipable.scss';

export default class Tooltipable extends Component {
  static propTypes = {
    children: PropTypes.node,
    tooltipContent: PropTypes.node,
    className: PropTypes.string,
    width: PropTypes.string,
    textAlign: PropTypes.string,
  };

  static defaultProps = {
    className: '',
    width: '16rem',
    textAlign: 'left',
  };

  render() {
    const { children, tooltipContent, className, width, textAlign } = this.props;

    return (
      <div className={`tooltipable ${className}`}>
        {children}
        <div className='tooltipable__tooltip' style={{ width: width, textAlign: textAlign }}>   
          {tooltipContent}
        </div>
      </div>
    )
  }
}
