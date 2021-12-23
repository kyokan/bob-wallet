import React, { Component } from 'react';
import PropTypes from "prop-types";
import classNames from 'classnames';
import './index.scss';

export class Table extends Component {
  render() {
    return (
      <div className={`table ${this.props.className}`}>
        {this.props.children}
      </div>
    )
  }
}

export class HeaderRow extends Component {
  render() {
    return (
      <div className="table__header">
        {this.props.children}
      </div>
    )
  }
}

export class HeaderItem extends Component {
  static propTypes = {
    shrink: PropTypes.number,
    grow: PropTypes.number,
    width: PropTypes.string,
  };

  render() {
    const {
      shrink,
      grow,
      width
    } = this.props;

    return (
      <div
        className="table__header__item"
        style={{
          flexShrink: shrink,
          flexGrow: grow,
          width: width,
        }}
      >
        {this.props.children}
      </div>
    )
  }
}

export class TableRow extends Component {
  render() {
    return (
      <div
        className={classNames('table__row', this.props.className)}
        onClick={this.props.onClick}
      >
        {this.props.children}
      </div>
    )
  }
}

export class TableItem extends Component {
  static propTypes = {
    shrink: PropTypes.number,
    grow: PropTypes.number,
    width: PropTypes.string,
  };

  render() {
    const {
      shrink,
      grow,
      width
    } = this.props;

    return (
      <div
        className={`table__row__item ${this.props.className}`}
        style={{
          flexShrink: shrink,
          flexGrow: grow,
          width: width,
        }}
      >
        {this.props.children}
      </div>
    )
  }
}
