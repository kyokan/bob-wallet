import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './index.scss';

export class AuctionPanel extends Component {
  static propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
  };

  static defaultProps = {
    className: '',
  };

  render() {
    return (
      <div className={`auction-panel ${this.props.className}`}>
        {this.props.children}
      </div>
    )
  }
}

export class AuctionPanelHeader extends Component {
  static propTypes = {
    children: PropTypes.node,
    title: PropTypes.string.isRequired,
  };

  render() {
    return (
      <div className="auction-panel__header">
        <div className="auction-panel__title">
          { this.props.title }
        </div>
        <div className="auction-panel__header__content">
          { this.props.children }
        </div>
      </div>
    );
  }
}

export class AuctionPanelHeaderRow extends Component {
  static propTypes = {
    label: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
  };

  static defaultProps = {
    className: '',
  };

  render() {
    return (
      <div className={`auction-panel__header__row ${this.props.className}`}>
        <div className="auction-panel__header__row__label">
          {this.props.label}
        </div>
        <div className="auction-panel__header__row__value">
          {this.props.children}
        </div>
      </div>
    )
  }
}

export class AuctionPanelFooter extends Component {
  static propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
  };

  static defaultProps = {
    className: '',
  };

  render() {
    return (
      <div className={`auction-panel__footer ${this.props.className}`}>
        {this.props.children}
      </div>
    );
  }
}
