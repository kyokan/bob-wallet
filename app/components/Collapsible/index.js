import React, { Component } from 'react';
import PropTypes from 'prop-types';
import cn from 'classnames';
import './collapsible.scss';
import {I18nContext} from "../../utils/i18n";

export default class Collapsible extends Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    className: PropTypes.string,
    defaultCollapsed: PropTypes.bool,
    children: PropTypes.node.isRequired,
    overflowY: PropTypes.bool,
  };

  static defaultProps = {
    className: '',
    defaultCollapsed: false,
    overflowY: true,
  };

  static contextType = I18nContext;

  constructor(props) {
    super(props);
    this.state = {
      isCollapsed: props.defaultCollapsed,
    };
  }

  toggle = () => {
    const { isCollapsed } = this.state;
    this.setState({ isCollapsed: !isCollapsed });
  };

  render() {
    const { title, className, pillContent } = this.props;
    const { isCollapsed } = this.state;

    return (
      <div
        className={cn(`collapsible ${className}`, {
          'collapsible--collapsed': isCollapsed,
        })}
      >
        <div className="collapsible__header">
          <div className="collapsible__header__title">
            {title}
            {!!pillContent &&
              <div className="collapsible__header__pill">
                {pillContent}
              </div>
            }
          </div>
          <div
            className="collapsible__header__toggle"
            onClick={this.toggle}
          >
            { isCollapsed ? this.context.t('show') : this.context.t('hide') }
          </div>
        </div>
        { this.renderContent() }
      </div>
    );
  }

  renderContent() {
    return (
      <div className={cn('collapsible__content', {
        'collapsible__content--hidden': this.state.isCollapsed,
        'collapsible__content--overflowY': this.props.overflowY,
      })} >
        { this.props.children }
      </div>
    )
  }
}


