import React, { Component } from 'react';
import PropTypes from 'prop-types';
import c from 'classnames';
import './index.scss';

export default class Checkbox extends Component {
  static propTypes = {
    checked: PropTypes.bool,
    onChange: PropTypes.func,
    className: PropTypes.string,
  };

  static defaultProps = {
    className: '',
  };

  render() {
    const { className, checked, onChange } = this.props;

    return (
      <div className={c('checkbox', className, { 'checkbox--checked': checked })}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
        />
      </div>
    );
  }
}
