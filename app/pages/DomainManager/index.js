import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as myDomainsActions from '../../ducks/myDomains';
import { formatName } from '../../utils/nameHelpers';
import './domain-manager.scss';
import { clientStub as aClientStub } from '../../background/analytics/client';
import fs from 'fs';
import ClaimNameForPayment from './ClaimNameForPayment';

const {dialog} = require('electron').remote;

const analytics = aClientStub(() => require('electron').ipcRenderer);

class DomainManager extends Component {
  static propTypes = {
    getMyNames: PropTypes.func.isRequired,
    myDomains: PropTypes.array.isRequired,
  };

  constructor(props) {
    super(props);

    this.state = {
      isShowingNameClaimForPayment: false,
    };
  }

  componentDidMount() {
    analytics.screenView('Domain Manager');
  }

  componentWillMount() {
    this.props.getMyNames();
  }

  handleExportClick() {
    let names = this.props.myDomains.map(({name}) => name);
    let data = names.join('\n');

    let savePath = dialog.showSaveDialogSync({
      filters: [{name: 'spreadsheet', extensions: ['csv']}],
    });

    if (savePath) {
      fs.writeFile(savePath, data, (err) => {
        if (err) {
          throw err;
        }
      });
    }
  }

  renderList() {
    return (
      <div className="domain-manager">
        <div className="domain-manager__buttons">
          <button
            className="extension_cta_button domain-manager__export-btn"
            onClick={this.handleExportClick.bind(this)}
          >
            Export All Names
          </button>
          <button
            className="extension_cta_button domain-manager__export-btn"
            onClick={() => this.setState({
              isShowingNameClaimForPayment: true,
            })}
          >
            Claim Name For Payment
          </button>
        </div>
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
              {formatName(name)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  renderEmpty() {
    return (
      <div className="domain-manager">
        <div className="domain-manager__buttons">
          <button
            className="extension_cta_button domain-manager__export-btn"
            onClick={() => this.setState({
              isShowingNameClaimForPayment: true,
            })}
          >
            Claim Name For Payment
          </button>
        </div>
        <div className="domain-manager__empty-text">
          You do not own any domains.
        </div>
      </div>
    );
  }

  render() {
    return (
      <>
        {this.props.myDomains.length
          ? this.renderList()
          : this.renderEmpty()}
        {this.state.isShowingNameClaimForPayment && (
          <ClaimNameForPayment
            onClose={() => this.setState({
              isShowingNameClaimForPayment: false,
            })}
          />
        )}
      </>
    );
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
