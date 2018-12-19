import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import './index.scss';

export default class Dropdown extends Component {
  static propTypes = {
    items: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
      }),
    ).isRequired,
    currentIndex: PropTypes.number,
    onChange: PropTypes.func,
    reversed: PropTypes.bool,
  };

  static defaultProps = {
    currentIndex: 0,
    onChange() {},
  };

  state = {
    isOpen: false,
  };

  toggle = () => this.setState({ isOpen: !this.state.isOpen });

  select(i) {
    this.setState({ isOpen: false });
    this.props.onChange(i);
  }

  render() {
    const { items, currentIndex, onChange } = this.props;
    const { label: currentLabel } = items[currentIndex] || {};

    return (
      <div
        className={c('dropdown', {
          'dropdown--opened': this.state.isOpen,
          'dropdown--reversed': this.props.reversed,
        })}
      >
        <div className="dropdown__current-item" onClick={this.toggle}>
          <div className="dropdown__current-item__text">
            {currentLabel}
          </div>
        </div>
        <div className="dropdown__options">
          {items.map(({ label }, i) => (
            <div
              key={i}
              className="dropdown__option"
              onClick={() => this.select(i)}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  }
}
