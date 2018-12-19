import * as React from 'react';
import PropTypes from 'prop-types';

export default class App extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired
  };

  render() {
    const { children } = this.props;
    return <React.Fragment>{children}</React.Fragment>;
  }
}
