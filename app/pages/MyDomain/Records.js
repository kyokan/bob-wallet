import React, { Component } from 'react';
import { Table, HeaderRow, HeaderItem, TableRow } from '../../components/Table';
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
    info: PropTypes.string,
    records: PropTypes.array.isRequired,
    resource: PropTypes.object,
  };

  state = {
    updatedResource: null,
  };

  getResource= () => {
    const resource = this.state.updatedResource || this.props.resource;
    return resource;
  };

  getResourceJSON = () => {
    const resource = this.getResource();

    return resource ? resource.toJSON() : {};
  };

  sendUpdate = json => {
    return this.props.sendUpdate(this.props.name, json);
  };

  onCreate = async ({ type, value, ttl }) => {
    const json = this.getResourceJSON();

    // switch (type) {
    //   case RECORD_TYPE.A:
    //   case RECORD_TYPE.AAAA:
    //     json.hosts = json.hosts || [];
    //     json.hosts.push(value);
    //     json.ttl = Number(ttl);
    //     break;
    //   case RECORD_TYPE.CNAME:
    //     json.canonical = value;
    //     json.ttl = Number(ttl);
    //     break;
    //   default:
    //     break;
    // }

    addRecordWithMutation(json, { type, value, ttl });
    this.setState({ updatedResource: Resource.fromJSON(json) });
    // await this.sendUpdate(json);
  };

  makeOnEdit = ({ type: lastType, value: lastValue, ttl: lastTtl }) => async ({ type, value, ttl }) => {
    const json = this.getResourceJSON();

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

    addRecordWithMutation(json, { type, value });

    if (ttl != null && ttl !== '' && lastTtl !== ttl) {
      json.ttl = Number(ttl);
    }

    this.setState({ updatedResource: Resource.fromJSON(json) });
    // await this.sendUpdate(json);
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
    const records = getRecords(this.getResource());
    return records.map((record, i) => {
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

  renderActionRow() {
    return (
      <TableRow className="records-table__action-row">
        <button className="records-table__action-row__submit-btn">
          Submit
        </button>
        <div className="records-table__action-row__dismiss-link">
          Discard Changes
        </div>
      </TableRow>
    )
  }

  render() {
    return (
      <div>
        <Table className="records-table">
          {this.renderHeaders()}
          {this.renderRows()}
          {this.renderCreateRecord()}
          {this.renderActionRow()}
        </Table>
      </div>
    )
  }
}

export default withRouter(
  connect(
    (state, ownProps) => {
      const domain = state.names[ownProps.name];
      const resource = getDecodedResource(domain);
      const records = getRecords(resource);

      return {
        info: domain && domain.info,
        resource,
        records,
      }
    },
    dispatch => ({
      sendUpdate: (name, json) => dispatch(nameActions.sendUpdate(name, json)),
    })
  )(Records)
);

function getDecodedResource(domain) {
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
    // ...getRecord(resource, 'toGlue'),
    ...getRecord(resource, 'toLOC'),
    ...getRecord(resource, 'toMX'),
    // ...getRecord(resource, 'toMXIP'),
    ...getRecord(resource, 'toNS'),
    // ...getRecord(resource, 'toNSEC'),
    ...getRecord(resource, 'toNSIP'),
    ...getRecord(resource, 'toOPENPGPKEY'),
    ...getRecord(resource, 'toRP'),
    ...getRecord(resource, 'toSMIMEA'),
    ...getRecord(resource, 'toSRV'),
    // ...getRecord(resource, 'toSRCIP'),
    // ...getRecord(resource, 'toSSHFP'),
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

function addRecordWithMutation(json, { type, value, ttl }) {
  switch (type) {
    case RECORD_TYPE.A:
    case RECORD_TYPE.AAAA:
      json.hosts = json.hosts || [];
      json.hosts.push(value);
      break;
    case RECORD_TYPE.CNAME:
      json.canonical = value;
      break;
    default:
      break;
  }

  if (ttl != null && ttl !== '') {
    json.ttl = Number(ttl);
  }

  return json;
}
