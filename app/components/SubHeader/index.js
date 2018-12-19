import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import c from 'classnames';
import { connect } from 'react-redux';
import SendModal from '../SendModal';
import ReceiveModal from '../ReceiveModal';
import './subheader.scss';
import * as domainActions from '../../ducks/domains';

@withRouter
@connect(
  state => ({
    initialized: state.wallet.initialized,
    isLocked: state.wallet.isLocked,
  }),
  dispatch => ({
    getNameInfo: tld => dispatch(domainActions.getNameInfo(tld)),
  })
)
export default class SubHeader extends Component {
  static propTypes = {
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }),
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired,
    }),
    getNameInfo: PropTypes.func.isRequired,
    isLocked: PropTypes.bool.isRequired,
    initialized: PropTypes.bool.isRequired,
  };

  constructor(props) {
    super(props);
    const { location: { pathname } } = props;
    this.state = {
      isShowingSendModal: /send/.test(pathname),
      isShowingReceiveModal: /receive/.test(pathname),
    };
  }


  handleInputValueChange = (e) => {
    const value = e.target.value;
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

  openSendModal = () => this.setState({ isShowingSendModal: true, isShowingReceiveModal: false });

  openReceiveModal = () => this.setState({
    isShowingSendModal: false,
    isShowingReceiveModal: true,
  });

  closeModal = () => this.setState({ isShowingSendModal: false, isShowingReceiveModal: false });

  renderModal = () => {
    const { isShowingReceiveModal, isShowingSendModal } = this.state;

    if (isShowingReceiveModal) {
      return <ReceiveModal onClose={this.closeModal} />;
    }

    if (isShowingSendModal) {
      return <SendModal onClose={this.closeModal} />;
    }

    return null;
  };

  render() {
    const name = c('subheader', {
      'subheader--empty': !this.props.initialized || this.props.isLocked
    });

    return (
      <div className={name}>
        <div className="subheader__content">
          <div className="subheader__logo" />
          {this.renderNav()}
        </div>
        { this.renderModal() }
      </div>
    )
  }

  renderNav() {
    if (!this.props.initialized || this.props.isLocked) {
      return null;
    }

    const { history: { push }, location: { pathname } } = this.props;
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
              'subheader__action--selected': !isShowingModal && /account|send|receive/.test(pathname),
            })}
            onClick={() => push('/account')}
          >
            Home
          </a>
          <a
            className={c('subheader__action', {
              'subheader__action--selected': isShowingSendModal,
            })}
            onClick={this.openSendModal}
          >
            Send
          </a>
          <a
            className={c('subheader__action', {
              'subheader__action--selected': isShowingReceiveModal,
            })}
            onClick={this.openReceiveModal}
          >
            Receive
          </a>
          <a
            className={c('subheader__action', {
              'subheader__action--selected': !isShowingModal && /get_coins/.test(pathname),
            })}
            onClick={() => push('/get_coins')}
          >
            Get Coins
          </a>
          <a
            className={c('subheader__action', {
              'subheader__action--selected': !isShowingModal && /settings/.test(pathname),
            })}
            onClick={() => push('/settings')}
          >
            Settings
          </a>
        </div>
      </React.Fragment>
    );
  }
};
