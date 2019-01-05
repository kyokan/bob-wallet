import React, { Component } from 'react';
import { Link, withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
import * as nameActions from '../../ducks/names';
import TLDInput from '../TLDInput';
import './topbar.scss';

@withRouter
@connect(
  null,
  dispatch => ({
    getNameInfo: tld => dispatch(nameActions.getNameInfo(tld))
  })
)
class Topbar extends Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func.isRequired
    }).isRequired,
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired
    }).isRequired,
    getNameInfo: PropTypes.func.isRequired
  };

  state = {
    inputValue: ''
  };

  render() {
    return (
      <div className="topbar">
        <div className="topbar__content">{this.renderNav()}</div>
      </div>
    );
  }

  handleInputValueChange = e => {
    const { value } = e.target;
    this.setState(() => ({
      inputValue: value.toLowerCase()
    }));
  };

  handleSearchClick = () => {
    const name = this.state.inputValue;

    if (!name.length) {
      return;
    }

    this.props.getNameInfo(name);
    this.props.history.push(`/domain/${name}`);
  };

  renderNav() {
    const { title } = this.props;

    return (
      <React.Fragment>
        <div className="topbar__title">{title}</div>
        <TLDInput minimalErrorDisplay />
        <div
          className={c('topbar__synced', {
            'topbar__synced--success': true,
            'topbar__synced--failure': false
          })}
        >
          Synchronized
        </div>
        <Link to="/settings" className="topbar__icon topbar__icon--settings" />
      </React.Fragment>
    );
  }
}

export default Topbar;
