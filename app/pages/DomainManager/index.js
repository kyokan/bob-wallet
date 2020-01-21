import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as myDomainsActions from '../../ducks/myDomains';
import './domain-manager.scss';
import { clientStub as aClientStub } from '../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

class DomainManager extends Component {
  static propTypes = {
    getMyNames: PropTypes.func.isRequired,
    myDomains: PropTypes.array.isRequired,
  };

  componentDidMount() {
    analytics.screenView('Domain Manager');
  }

  componentWillMount() {
    this.props.getMyNames();
  }

  renderList() {
    return (
      <div className="domain-manager">
        {this.props.myDomains.map(({name, nameHash}) => (
          <div
            className="domain-manager__domain"
            key={nameHash}
            onClick={() => this.props.history.push(`/domain_manager/${name}`)}
          >
            <div
              className="domain-manager__domain__icon"
              style={{backgroundColor: getColor(name)}}
            />
            <div className="domain-manager__domain__name">
              {`${name}/`}
            </div>
          </div>
        ))}
      </div>
    );
  }

  renderEmpty() {
    return (
      <div className="domain-manager">
        <div className="domain-manager__empty-text">
          You do not own any domains.
        </div>
      </div>
    );
  }

  render() {
    return this.props.myDomains.length
      ? this.renderList()
      : this.renderEmpty();
  }
}

export default withRouter(
  connect(
    state => ({
      myDomains: state.myDomains.names,
    }),
    dispatch => ({
      getMyNames: () => dispatch(myDomainsActions.getMyNames()),
    }),
  )(DomainManager),
);

function getColor(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var colour = '#';
  for (var i = 0; i < 3; i++) {
    var value = (hash >> (i * 8)) & 0xFF;
    colour += ('00' + value.toString(16)).substr(-2);
  }
  return colour;
}
