import React, { Component } from 'react';
import { I18nContext } from "../../utils/i18n";
import './bid-search-input.scss';

export default class BidSearchInput extends Component {
  static contextType = I18nContext;

  render() {
    const {t} = this.context;

    const {
      className,
      placeholder,
      onChange,
      value
    } = this.props;

    return (
      <div className={`bid-search-input ${className || ''}`}>
        <div className="bid-search-input__icon" />
        <input
          className="bid-search-input__input"
          placeholder={placeholder || t('searchYourBids')}
          onChange={onChange}
          value={value}
        />
      </div>
    );
  }
}
