import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
import './topbar.scss';

@withRouter
// @connect(
//   state => ({
//     initialized: state.wallet.initialized,
//     isLocked: state.wallet.isLocked,
//   }),
//   dispatch => ({
//     getNameInfo: tld => dispatch(domainActions.getNameInfo(tld)),
//   })
// )
class Topbar extends Component {
  // static propTypes = {
  //   history: PropTypes.shape({
  //     push: PropTypes.func.isRequired,
  //   }).isRequired,
  //   location: PropTypes.shape({
  //     pathname: PropTypes.string.isRequired,
  //   }).isRequired,
  //   getNameInfo: PropTypes.func.isRequired,
  //   isLocked: PropTypes.bool.isRequired,
  //   initialized: PropTypes.bool.isRequired,
  // };

  state = {
    inputValue: ''
  };

  render() {
    const name = c('topbar', {
      // 'subheader--empty': !this.props.initialized || this.props.isLocked
    });

    return (
      <div className={name}>
        <div className="topbar__content">{this.renderNav()}</div>
      </div>
    );
  }

  handleInputValueChange = e => {
    const { value } = e.target;
    this.setState(() => ({
      inputValue: value
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
    // if (!this.props.initialized || this.props.isLocked) {
    //   return null;
    // }

    const {
      history: { push },
      location: { pathname },
      title: title
    } = this.props;

    return (
      <React.Fragment>
        <div className="topbar__title">{title}</div>
        <div className="topbar__search">
          <input
            className="topbar__search__input"
            type="text"
            value={this.state.inputValue}
            onChange={this.handleInputValueChange}
            onKeyDown={e => e.key === 'Enter' && this.handleSearchClick()}
            placeholder="Search top-level domain"
          />
          <div
            className="topbar__search__icon"
            onClick={this.handleSearchClick}
          />
        </div>

        <div
          className={c('topbar__synced', {
            'topbar__synced--success': true,
            'topbar__synced--failure': false
          })}
        >
          Synchronized
        </div>
        <div className="topbar__icon topbar__icon--notifications" />
        <div className="topbar__icon topbar__icon--settings" />
      </React.Fragment>
    );
  }
}

export default Topbar;
