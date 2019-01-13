import React, { Component } from 'react';
import c from 'classnames';
import './notification.scss';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { clear } from '../../ducks/notifications'

@connect(
  (state) => ({
    message: state.notifications.message,
    type: state.notifications.type,
  }),
  (dispatch) => ({
    clear: () => dispatch(clear())
  })
)
export default class Notification extends Component {
  static propTypes = {
    message: PropTypes.string.isRequired,
    type: PropTypes.oneOf([
      'success',
      'error'
    ]).isRequired
  };

  el = null;

  componentDidUpdate() {
    if (!this.el) {
      return;
    }

    if (!this.props.message) {
      return;
    }

    setTimeout(() => (this.el.style.transform = 'translateY(60px)'), 0);
    setTimeout(this.clear, 7000);
  }

  clear = () => {
    this.el.style.transform = 'translateY(calc(-100% - 8px))';
    setTimeout(() => this.props.clear(), 150);
  };

  render() {
    if (!this.props.message) {
      return null;
    }

    const name = c('notification', `notification--${this.props.type}`);

    return (
      <div className={name} ref={(ref) => (this.el = ref)}>
        <div className="notification__close" onClick={this.clear}/>
        {this.props.message}
      </div>
    );
  }
}
