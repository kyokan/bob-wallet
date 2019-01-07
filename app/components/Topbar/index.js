import React, { Component } from 'react';
import { Link, withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
import * as nameActions from '../../ducks/names';
import TLDInput from '../TLDInput';
import { Logo } from '../Logo';
import { shouldHideSidebar } from '../../utils/shouldHideSidebar';
import './topbar.scss';

@withRouter
@connect(
  state => {
    const { chain, isRunning } = state.node;
    const { progress } = chain || {};

    return {
      isSynchronizing: isRunning && progress < 1,
      isSynchronized: isRunning && progress === 1,
      progress
    };
  },
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
    getNameInfo: PropTypes.func.isRequired,
    isSynchronizing: PropTypes.bool.isRequired,
    isSynchronized: PropTypes.bool.isRequired
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

  renderLogo() {
    const { history } = this.props;
    return (
      <div className="topbar__logoHeader">
        <div
          className="topbar__logoHeader__backArrow"
          onClick={() => history.goBack()}
        />
        <Logo onClick={() => history.goBack()} />
      </div>
    );
  }

  renderTitle(title) {
    return <div className="topbar__title">{title}</div>;
  }

  renderNav() {
    const {
      title,
      isSynchronized,
      isSynchronizing,
      location: { pathname }
    } = this.props;

    return (
      <React.Fragment>
        {shouldHideSidebar(pathname)
          ? this.renderLogo()
          : this.renderTitle(title)}
        {!/domains$/.test(pathname) && <TLDInput minimalErrorDisplay />}
        <div
          className={c('topbar__synced', {
            'topbar__synced--success': isSynchronized,
            'topbar__synced--failure': !isSynchronized && !isSynchronizing
          })}
        >
          {this.getSyncText()}
        </div>
        <Link to="/settings" className="topbar__icon topbar__icon--settings" />
      </React.Fragment>
    );
  }

  getSyncText() {
    const { isSynchronized, isSynchronizing, progress } = this.props;

    if (isSynchronizing) {
      return `Synchronizing... ${
        progress ? '(' + (progress * 100).toFixed(2) + '%)' : ''
      }`;
    }

    if (isSynchronized) {
      return 'Synchronized';
    }

    return 'Not Synchronized';
  }
}

export default Topbar;
