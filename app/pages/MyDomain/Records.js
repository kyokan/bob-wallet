import React, { Component } from 'react';
import { Table, HeaderRow, HeaderItem, TableRow, TableItem } from '../../components/Table';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import connect from 'react-redux/es/connect/connect';
import Resource from '../../../node_modules/hsd/lib/dns/resource'
import CreateRecord from './CreateRecord';
import EditableRecord from './EditableRecord';

class Records extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    domain: PropTypes.object.isRequired,
    record: PropTypes.array.isRequired,
    resource: PropTypes.object,
  };

  renderHeaders() {
    return (
      <HeaderRow>
        <HeaderItem>
          <div>Type</div>
        </HeaderItem>
        <HeaderItem>Value</HeaderItem>
        <HeaderItem>TTL</HeaderItem>
        <HeaderItem />
      </HeaderRow>
    )
  }

  renderRows() {
    return this.props.records.map((record, i) => {
      return (
        <EditableRecord
          name={this.props.name}
          record={record}
          key={i}
        />
      );
    });
  }

  renderCreateRecord() {
    return <CreateRecord name={this.props.name}/>;
  }

  render() {
    return (
      <div>
        <Table className="records-table">
          {this.renderHeaders()}
          {this.renderCreateRecord()}
          {this.renderRows()}
        </Table>
      </div>
    )
  }
}

export default withRouter(
  connect(
    (state, ownProps) => {
      const domain = state.names[ownProps.name];
      const resource = getResource(domain);
      const records = getRecords(resource);
      return {
        domain: state.names[ownProps.name],
        resource,
        records,
      }
    },
  )(Records)
);

function getResource(domain) {
  const { info } = domain || {};

  if (!info) {
    return;
  }

  const { data } = info;

  if (!data) {
    return;
  }

  return Resource.decode(new Buffer(data, 'hex'));
}

function getRecords(resource) {
  if (!resource) {
    return [];
  }

  return [
    ...getRecord(resource, 'toA'),
    ...getRecord(resource, 'toAAAA'),
    ...getRecord(resource, 'toCNAME'),
    ...getRecord(resource, 'toDNAME'),
    ...getRecord(resource, 'toDNS'),
    ...getRecord(resource, 'toDS'),
    ...getRecord(resource, 'toGlue'),
    ...getRecord(resource, 'toLOC'),
    ...getRecord(resource, 'toMX'),
    ...getRecord(resource, 'toMXIP'),
    ...getRecord(resource, 'toNS'),
    // ...getRecord(resource, 'toNSEC'),
    ...getRecord(resource, 'toNSIP'),
    ...getRecord(resource, 'toOPENPGPKEY'),
    ...getRecord(resource, 'toRP'),
    ...getRecord(resource, 'toSMIMEA'),
    ...getRecord(resource, 'toSRC'),
    ...getRecord(resource, 'toSRCIP'),
    ...getRecord(resource, 'toSSHFP'),
  ];
}

function getRecord(resource, methodName) {
  try {
    return resource[methodName]();
  } catch (error) {
    return [];
  }
}
