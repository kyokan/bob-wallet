import React, { Component } from 'react';
import { Table, HeaderRow, HeaderItem, TableRow } from '../../components/Table';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import connect from 'react-redux/es/connect/connect';
import cn from 'classnames';
import Resource from '../../../node_modules/hsd/lib/dns/resource'
import CreateRecord from './CreateRecord';
import EditableRecord from './EditableRecord';
import * as nameActions from '../../ducks/names';
import { filterOne, deepEqual } from '../../utils/helpers';
import { showSuccess } from '../../ducks/notifications';

const { RECORD_TYPE } = nameActions;

class Records extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    resource: PropTypes.object,
    pendingData: PropTypes.string,
    showSuccess: PropTypes.func.isRequired,
    sendUpdate: PropTypes.func.isRequired,
  };

  static renderHeaders() {
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

  state = {
    updatedResource: null,
    isUpdating: false,
    errorMessage: '',
  };

  getResource= () => {
    if (this.props.pendingData) {
      return getDecodedResource({
        info: {
          data: this.props.pendingData,
        },
      })
    }

    return this.state.updatedResource || this.props.resource;
  };

  getResourceJSON = () => {
    const resource = this.getResource();

    return resource ? resource.toJSON() : {};
  };

  hasChanged = () => {
    const oldResource = this.props.resource;
    const newResource = this.state.updatedResource;

    if (!oldResource || !newResource) {
      return false;
    }
    return !deepEqual(oldResource.toJSON(), newResource.toJSON());
  };

  sendUpdate = async () => {
    this.setState({ isUpdating: true });
    try {
      const newResource = this.state.updatedResource;
      const json = newResource.toJSON();
      await this.props.sendUpdate(this.props.name, json);
      this.setState({ isUpdating: false });
      console.log({ json })
      this.props.showSuccess('Your update request is sent successfully! It should be confirmed in 15 minutes.');
    } catch (e) {
      this.setState({
        isUpdating: false,
        errorMessage: e.message,
      });
    }

  };

  onCreate = async ({ type, value, ttl }) => {
    const json = this.getResourceJSON();
    addRecordWithMutation(json, { type, value, ttl });
    this.setState({ updatedResource: Resource.fromJSON(json) });
  };

  onRemove = async ({ type, value, ttl }) => {
    const json = this.getResourceJSON();
    removeRecordWithMutation(json, { type, value, ttl });
    this.setState({ updatedResource: Resource.fromJSON(json) });
  };

  makeOnEdit = ({ type: lastType, value: lastValue, ttl: lastTtl }) => async ({ type, value, ttl }) => {
    const json = this.getResourceJSON();

    // Remove old record
    removeRecordWithMutation(json, {
      type: lastType,
      value: lastValue,
    });

    // Add new record
    addRecordWithMutation(json, { type, value });

    if (ttl != null && ttl !== '' && lastTtl !== ttl) {
      json.ttl = Number(ttl);
    }

    this.setState({ updatedResource: Resource.fromJSON(json) });
  };

  renderRows() {
    const { name } = this.props;
    const records = getRecords(this.getResource());
    return records.map((record, i) => {
      const json = getRecordJson(record);
      const { type, value } = json;
      return (type && value) && (
        <EditableRecord
          key={`${name}-${type}-${value}-${i}`}
          name={name}
          record={json}
          onEdit={this.makeOnEdit(json)}
          onRemove={this.onRemove}
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
        <div className="records-table__action-row__error-message">
          {this.state.errorMessage}
        </div>
        <button
          className="records-table__action-row__submit-btn"
          disabled={!this.hasChanged() || this.state.isUpdating}
          onClick={this.sendUpdate}
        >
          Submit
        </button>
        <button
          className="records-table__action-row__dismiss-link"
          onClick={() => this.setState({ updatedResource: null })}
          disabled={!this.hasChanged() || this.state.isUpdating}
        >
          Discard Changes
        </button>
      </TableRow>
    )
  }

  renderPendingUpdateOverlay() {
    return (
      <div className="records-table__pending-overlay">
        <div className="records-table__pending-overlay__content">Updating records...</div>
      </div>
    )
  }

  render() {
    return (
      <div>
        <Table
          className={cn("records-table", {
            'records-table--pending': this.props.pendingData,
          })}
        >
          {Records.renderHeaders()}
          {this.renderRows()}
          {!this.props.pendingData ? this.renderCreateRecord() : null}
          {!this.props.pendingData ?  this.renderActionRow() : null}
          {this.props.pendingData ? this.renderPendingUpdateOverlay() : null}
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

      return {
        resource,
        pendingData: getPendingData(domain),
      }
    },
    dispatch => ({
      sendUpdate: (name, json) => dispatch(nameActions.sendUpdate(name, json)),
      showSuccess: (message) => dispatch(showSuccess(message)),
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
    ...getRecord(resource, 'toTXT'),
    ...getRecord(resource, 'toDS'),
    // ...getRecord(resource, 'toDNAME'),
    // ...getRecord(resource, 'toDNS'),
    // ...getRecord(resource, 'toGlue'),
    // ...getRecord(resource, 'toLOC'),
    ...getRecord(resource, 'toMX'),
    // ...getRecord(resource, 'toMXIP'),
    ...getRecord(resource, 'toNS'),
    // ...getRecord(resource, 'toNSEC'),
    // ...getRecord(resource, 'toNSIP'),
    // ...getRecord(resource, 'toOPENPGPKEY'),
    // ...getRecord(resource, 'toRP'),
    // ...getRecord(resource, 'toSMIMEA'),
    // ...getRecord(resource, 'toSRV'),
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
  } else if (type === RECORD_TYPE.CNAME) {
    value = json.data.target;
  } else if (type === RECORD_TYPE.TXT) {
    value = json.data.txt[0];
  } else if (type === RECORD_TYPE.DS) {
    value = JSON.stringify({
      keyTag: json.data.keyTag,
      algorithm: json.data.algorithm,
      digest: json.data.digest,
      digestType: json.data.digestType,
    });
  } else if (type === RECORD_TYPE.MX) {
    const { mx, preference } = json.data;
    value = `${preference} ${mx}`;
  } else if (type === RECORD_TYPE.NS) {
    value = json.data.ns;
  } else {
    console.log('uncaught', json)
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
    case RECORD_TYPE.TXT:
      json.text = json.text || [];
      json.text.push(value);
      break;
    case RECORD_TYPE.DS:
      json.ds = json.ds || [];
      json.ds.push(JSON.parse(value));
      break;
    case RECORD_TYPE.MX:
      const [ priority, target ] = value.split(' ');
      json.service = json.service || [];
      json.service.push({
        protocol: 'tcp.',
        service: 'smtp.',
        target: target,
        priority: Number(priority),
      });
      break;
    case RECORD_TYPE.NS:
      json.ns = json.ns || [];
      json.ns.push(value);
    default:
      break;
  }

  if (ttl != null && ttl !== '') {
    json.ttl = Number(ttl);
  }

  return json;
}

function removeRecordWithMutation(json, { type, value, ttl }) {
  // Remove old record
  switch (type) {
    case RECORD_TYPE.A:
    case RECORD_TYPE.AAAA:
      json.hosts = json.hosts || [];
      json.hosts = filterOne(json.hosts, host => host !== value);
      break;
    case RECORD_TYPE.CNAME:
      json.canonical = null;
      break;
    case RECORD_TYPE.TXT:
      json.text = json.text || [];
      json.text = filterOne(json.text, txt => txt !== value);
      break;
    case RECORD_TYPE.DS:
      json.ds = json.ds || [];
      json.ds = filterOne(json.ds, data => {
        const { keyTag, algorithm, digestType, digest } = data;
        return !deepEqual({ keyTag, algorithm, digestType, digest }, JSON.parse(value))
      });
      break;
    case RECORD_TYPE.MX:
      json.service = json.service || [];
      json.service = filterOne(json.service, ({ target, priority}) => {
        return `${priority} ${target}` !== value;
      });
      break;
    case RECORD_TYPE.NS:
      json.ns = json.ns || [];
      json.ns = filterOne(json.ns, ns => ns !== value);
      break;
    default:
      break;
  }
  return json;
}

function getPendingData(domain) {
  if (!domain) {
    return '';
  }

  if (domain.pendingOperation === 'UPDATE') {
    return domain.pendingOperationMeta.data;
  }

  return '';
}
