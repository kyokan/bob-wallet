import React, { Component } from 'react';
import { Table, HeaderRow, HeaderItem } from '../../components/Table';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import connect from 'react-redux/es/connect/connect';
import Resource from '../../../node_modules/hsd/lib/dns/resource'
import CreateRecord from './CreateRecord';
import EditableRecord from './EditableRecord';
import { RECORD_TYPE } from '../../ducks/names';
import * as nameActions from '../../ducks/names';

class Records extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    records: PropTypes.array.isRequired,
    resource: PropTypes.object,
  };

  sendUpdate = json => {
    return this.props.sendUpdate(this.props.name, json);
  };

  onCreate = async ({ type, value, ttl }) => {
    const json = this.props.resource
      ? this.props.resource.toJSON()
      : { hosts: [] };

    switch (type) {
      case RECORD_TYPE.A:
      case RECORD_TYPE.AAAA:
        json.hosts = json.hosts || [];
        json.hosts.push(value);
        json.ttl = Number(ttl);
        break;
      case RECORD_TYPE.CNAME:
        json.canonical = value;
        json.ttl = Number(ttl);
        break;
      default:
        break;
    }

    await this.sendUpdate(json);
  };

  makeOnEdit = ({ type: lastType, value: lastValue, ttl: lastTtl }) => async ({ type, value, ttl }) => {
    const json = this.props.resource
      ? this.props.resource.toJSON()
      : { hosts: [] };

    // Remove old record
    switch (lastType) {
      case RECORD_TYPE.A:
      case RECORD_TYPE.AAAA:
        json.hosts = json.hosts || [];
        json.hosts = json.hosts.filter(host => host !== lastValue);
        break;
      case RECORD_TYPE.CNAME:
        json.canonical = null;
        break;
      default:
        break;
    }

    // Add updated record
    switch (type) {
      case RECORD_TYPE.A:
      case RECORD_TYPE.AAAA:
        json.hosts = json.hosts || [];
        json.hosts.push(value);
        json.ttl = Number(ttl);
        break;
      case RECORD_TYPE.CNAME:
        json.canonical = value;
        json.ttl = Number(ttl);
        break;
      default:
        break;
    }

    if (lastTtl !== ttl) {
      json.ttl = ttl;
    }

    await this.sendUpdate(json);
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
          onEdit={this.makeOnEdit(getRecordJson(record))}
        />
      );
    });
  }

  renderCreateRecord() {
    return <CreateRecord name={this.props.name} onCreate={this.onCreate}/>;
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
        resource,
        records,
      }
    },
    dispatch => ({
      sendUpdate: (name, json) => dispatch(nameActions.sendUpdate(name, json)),
    })
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

function getRecordJson(record) {
  const json = record.getJSON();
  const type = json.type;
  const ttl = json.ttl;

  let value = '';

  if ([RECORD_TYPE.A, RECORD_TYPE.AAAA].includes(type)) {
    value = json.data.address;
  }

  if (type === RECORD_TYPE.CNAME) {
    value = json.data.target;
  }

  return { type, value, ttl };
}
