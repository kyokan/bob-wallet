import React, { Component } from 'react';
import PropTypes from 'prop-types';
import cn from 'classnames';
import './collapsible.scss';

export default class Collapsible extends Component {
  static propTypes = {
    title: PropTypes.string.isRequired,
    className: PropTypes.string,
    defaultCollapsed: PropTypes.bool,
    children: PropTypes.node.isRequired,
  };

  static defaultProps = {
    className: '',
    defaultCollapsed: false,
  };

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
            { isCollapsed ? 'Show': 'Hide' }
          </div>
        </div>
        { this.renderContent() }
      </div>
    );
  }

  renderContent() {
    return (
      <div className={cn('collapsible__content', {
        'collapsible__content--hidden': this.state.isCollapsed
      })} >  
        { this.props.children }
      </div>
    )
  }
}


