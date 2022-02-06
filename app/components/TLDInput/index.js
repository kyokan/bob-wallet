import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import c from 'classnames';
import * as nameActions from '../../ducks/names';
import { verifyName } from '../../utils/nameChecker';
import { decodePunycode } from '../../utils/nameHelpers';
import { I18nContext } from "../../utils/i18n";
import './TLDInput.scss';

@withRouter
@connect(
  null,
  dispatch => ({
    getNameInfo: tld => dispatch(nameActions.getNameInfo(tld))
  })
)
class TLDInput extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired
    }).isRequired,
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired
    }).isRequired,
    getNameInfo: PropTypes.func.isRequired
  };

  static contextType = I18nContext;

  state = {
    inputValue: '',
    showError: false
  };

  handleInputValueChange = e => {
    const { value } = e.target;
    this.setState(() => ({
      inputValue: value.toLowerCase(),
      showError: false
    }));
  };

  handleSearchClick = () => {
    const name = decodePunycode(this.state.inputValue);

    if (!name.length) {
      return;
    }

    if (verifyName(name)) {
      this.props.getNameInfo(name);
      this.props.history.push(`/domain/${name}`);
      return;
    }

    return this.setState({ showError: true });
  };

  render() {
    const {t} = this.context;

    const { showError } = this.state;
    const { minimalErrorDisplay, greyTheme } = this.props;
    return (
      <div>
        <div
          className={c('tld', {
            'tld--error': showError,
            'tld--grey-theme': greyTheme,
          })}
        >
          <input
            className={c('tld__input', {
              'tld__input--error': showError,
              'tld__input--grey-theme': greyTheme,
            })}
            type="text"
            value={this.state.inputValue}
            onChange={this.handleInputValueChange}
            onKeyDown={e => e.key === 'Enter' && this.handleSearchClick()}
            placeholder={t('searchInputPlaceholder')}
            autoFocus
          />
          <div
            className={c('tld__icon', {
              'tld__icon--error': showError
            })}
            onClick={this.handleSearchClick}
          />
        </div>
        {!minimalErrorDisplay && (
          <div className="tld__error">{showError && 'Invalid domain name' }</div>
        )}
      </div>
    );
  }
}

export default TLDInput;
