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
    left: PropTypes.string,
  };

  static defaultProps = {
    className: '',
    width: '16rem',
    textAlign: 'left',
    left: '0px',
  };

  render() {
    const { children, tooltipContent, className, width, textAlign, left } = this.props;

    return (
      <div className={`tooltipable ${className}`}>
        {children}
        <div className='tooltipable__tooltip' style={{ width, textAlign, left }}>   
          {tooltipContent}
        </div>
      </div>
    )
  }
}
