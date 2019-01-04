import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import c from 'classnames';
import * as nameActions from '../../ducks/names';
import { verifyName } from '../../utils/nameChecker';
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
    const name = this.state.inputValue;

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
    const { showError } = this.state;
    const { minimalErrorDisplay } = this.props;
    return (
      <div>
        <div
          className={c('tld', {
            'tld--error': showError
          })}
        >
          <input
            className={c('tld__input', {
              'tld__input--error': showError
            })}
            type="text"
            value={this.state.inputValue}
            onChange={this.handleInputValueChange}
            onKeyDown={e => e.key === 'Enter' && this.handleSearchClick()}
            placeholder="Search top-level domain"
          />
          <div
            className={c('tld__icon', {
              'tld__icon--error': showError
            })}
            onClick={this.handleSearchClick}
          />
        </div>
        {showError && !minimalErrorDisplay && (
          <div className="tld__error">Invalid domain name.</div>
        )}
      </div>
    );
  }
}

export default TLDInput;
