import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import './index.scss';

export default class Dropdown extends Component {
  static propTypes = {
    items: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        disabled: PropTypes.bool,
      }),
    ).isRequired,
    className: PropTypes.string,
    currentIndex: PropTypes.number,
    onChange: PropTypes.func,
    reversed: PropTypes.bool,
  };

  static defaultProps = {
    currentIndex: 0,
    onChange() {},
    className: '',
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
    const { items, currentIndex, className } = this.props;
    const { label: currentLabel } = items[currentIndex] || {};

    return (
      <div
        className={c('dropdown', className, {
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
          {items.map(({ label, disabled, value }, i) => (
            <div
              key={i}
              className={c('dropdown__option', {
                'dropdown__option--disabled': disabled,
              })}
              onClick={() => !disabled && this.select(value || i)}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  }
}
