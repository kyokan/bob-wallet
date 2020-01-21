import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
// import auctions.js from '../../../auctions.js/extension.js';
import './status.scss';

export default class ConnectLedger extends Component {

  static propTypes = {
    currentStep: PropTypes.number,
    totalSteps: PropTypes.number,
  };

  static defaultProps = {
    currentStep: 1,
    totalSteps: 5,
  };

  renderStatusBar() {
    const { currentStep , totalSteps } = this.props;
    const elements = [];
    for (let i = 0; i < totalSteps; i++) {
      elements.push(
        <span
          key={i}
          className={
            classNames([
              'status_bar_element',
              i < currentStep ? 'status_bar_element__active' : false
            ])
          }
        />
      );
    }

    return elements;
  }

  render() {
    const { currentStep, totalSteps } = this.props;
    const barSegments = this.renderStatusBar();

    return (
        <div className='status_bar_container'>
          <span className='status_bar'>
            {barSegments}
          </span>
          <span className="status__step-number">
            {`${currentStep === 0 ? 1 : currentStep}/${totalSteps}`}
          </span>
        </div>
    );
  }
}
