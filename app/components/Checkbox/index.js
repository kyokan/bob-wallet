import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import './index.scss';

export default class Checkbox extends Component {
  static propTypes = {
    checked: PropTypes.bool,
    onChange: PropTypes.func,
    className: PropTypes.string,
    disabled: PropTypes.bool,
  };

  static defaultProps = {
    className: '',
    disabled: false,
  };

  render() {
    const { className, checked, onChange, disabled } = this.props;

    return (
      <div className={c('checkbox', className, { 'checkbox--checked': checked })}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    );
  }
}
