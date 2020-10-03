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
import {HeaderItem, HeaderRow, Table, TableItem, TableRow} from "../../components/Table";
import Blocktime from "../../components/Blocktime";
import {displayBalance} from "../../utils/balances";

const {dialog} = require('electron').remote;

const analytics = aClientStub(() => require('electron').ipcRenderer);

class DomainManager extends Component {
  static propTypes = {
    getMyNames: PropTypes.func.isRequired,
    namesList: PropTypes.object.isRequired,
    names: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);

    this.state = {
      isShowingNameClaimForPayment: false,
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.namesList.join('') !== nextProps.namesList.join('')
      || this.state.isShowingNameClaimForPayment !== nextState.isShowingNameClaimForPayment;
  }

  componentDidMount() {
    analytics.screenView('Domain Manager');
  }

  componentWillMount() {
    this.props.getMyNames();
  }

  handleExportClick() {
    let names = this.props.namesList;
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
    const {namesList, names, history} = this.props;
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
        <Table className="domain-manager__table">
          <HeaderRow>
            <HeaderItem>TLD</HeaderItem>
            <HeaderItem>Expiry</HeaderItem>
            <HeaderItem>HNS Paid</HeaderItem>
          </HeaderRow>
          {namesList.map((name) => {
            return (
              <DomainRow
                key={`${name}`}
                name={name}
                onClick={() => history.push(`/domain_manager/${name}`)}
              />
            );
          })}
        </Table>
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
        {this.props.namesList.length ? this.renderList() : this.renderEmpty()}
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
      names: state.myDomains.names,
      namesList: Object.keys(state.myDomains.names),
    }),
    dispatch => ({
      getMyNames: () => dispatch(myDomainsActions.getMyNames()),
    }),
  )(DomainManager),
);


const DomainRow = connect(
  state => ({
    names: state.myDomains.names,
  }),
)(_DomainRow);
function _DomainRow(props) {
  const { name, names, onClick } = props;
  return (
    <TableRow key={`${name}`} onClick={onClick}>
      <TableItem>{formatName(name)}</TableItem>
      <TableItem>
        <Blocktime
          height={names[name].height + 105120}
          format="ll"
          fromNow
        />
      </TableItem>
      <TableItem>{displayBalance(names[name].highest, true)}</TableItem>
    </TableRow>
  )
}
