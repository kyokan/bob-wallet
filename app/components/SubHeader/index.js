import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
import './subheader.scss';

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
class SubHeader extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired,
    }).isRequired,
    getNameInfo: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    const {
      location: { pathname }
    } = props;
    this.state = {
      isShowingSendModal: /send/.test(pathname),
      isShowingReceiveModal: /receive/.test(pathname)
    };
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

  render() {
    return (
      <div className='subheader'>
        <div className="subheader__content">
          <div className="subheader__logo" />
          {this.renderNav()}
        </div>
      </div>
    );
  }

  renderNav() {
    const {
      history: { push },
      location: { pathname }
    } = this.props;
    const { isShowingSendModal, isShowingReceiveModal } = this.state;
    const isShowingModal = isShowingSendModal || isShowingReceiveModal;

    return (
      <React.Fragment>
        <div className="subheader__search">
          <input
            className="subheader__search__input"
            type="text"
            value={this.state.inputValue}
            onChange={this.handleInputValueChange}
            onKeyDown={e => e.key === 'Enter' && this.handleSearchClick()}
            placeholder="Lookup top-level domain"
          />
          <div
            className="subheader__search__icon"
            onClick={this.handleSearchClick}
          />
        </div>
        <div className="subheader__actions">
          <a
            className={c('subheader__action', {
              'subheader__action--selected':
                !isShowingModal && /account|send|receive/.test(pathname)
            })}
            onClick={() => push('/account')}
          >
            Home
          </a>
          <a
            className={c('subheader__action', {
              'subheader__action--selected': isShowingSendModal
            })}
            onClick={this.openSendModal}
          >
            Send
          </a>
          <a
            className={c('subheader__action', {
              'subheader__action--selected': isShowingReceiveModal
            })}
            onClick={this.openReceiveModal}
          >
            Receive
          </a>
          <a
            className={c('subheader__action', {
              'subheader__action--selected':
                !isShowingModal && /get_coins/.test(pathname)
            })}
            onClick={() => push('/get_coins')}
          >
            Get Coins
          </a>
          <a
            className={c('subheader__action', {
              'subheader__action--selected':
                !isShowingModal && /settings/.test(pathname)
            })}
            onClick={() => push('/settings')}
          >
            Settings
          </a>
        </div>
      </React.Fragment>
    );
  }
}

export default SubHeader;
