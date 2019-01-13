import React, { Component } from 'react';
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
  render() {
    return (
      <div className="table__header__item">
        {this.props.children}
      </div>
    )
  }
}

export class TableRow extends Component {
  render() {
    return (
      <div
        className={`table__row ${this.props.className}`}
        onClick={this.props.onClick}
      >
        {this.props.children}
      </div>
    )
  }
}

export class TableItem extends Component {
  render() {
    return (
      <div className={`table__row__item ${this.props.className}`}>
        {this.props.children}
      </div>
    )
  }
}
