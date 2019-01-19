import React, { Component } from 'react';
import { Table, HeaderRow, HeaderItem, TableRow } from '../../components/Table';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import connect from 'react-redux/es/connect/connect';
import cn from 'classnames';
import Resource from '../../../node_modules/hsd/lib/dns/resource';
import CreateRecord from './CreateRecord';
import EditableRecord from './EditableRecord';
import * as nameActions from '../../ducks/names';
import { deepEqual } from '../../utils/helpers';
import { showSuccess } from '../../ducks/notifications';
import { serializeResource, deserializeResource } from '../../utils/record-helpers';

const { RECORD_TYPE } = nameActions;

class Records extends Component {
  static propTypes = {
    name: PropTypes.string.isRequired,
    resource: PropTypes.object,
    records: PropTypes.array,
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
    isUpdating: false,
    errorMessage: '',
    records: [],
    ttl: null,
  };

  componentWillReceiveProps(nextProps) {
    this.setState({
      records: nextProps.records,
    });
  }

  hasChanged = () => {
    const oldRecords = this.props.records;
    const newRecords = this.state.records;

    if (!oldRecords && !newRecords) {
      return false;
    }

    if (!oldRecords && newRecords) {
      return true;
    }

    if (oldRecords && !newRecords) {
      return false;
    }

    return (this.state.ttl && this.props.resource.ttl !== this.state.ttl) ||
      !deepEqual(deserializeResource(oldRecords).getJSON(), deserializeResource(newRecords).getJSON());
  };

  sendUpdate = async () => {
    this.setState({ isUpdating: true });
    try {
      const newResource = deserializeResource(this.state.records);
      const json = newResource.toJSON();
      await this.props.sendUpdate(this.props.name, json);
      this.setState({ isUpdating: false });
      // console.log({ json })
      this.props.showSuccess('Your update request is sent successfully! It should be confirmed in 15 minutes.');
    } catch (e) {
      this.setState({
        isUpdating: false,
        errorMessage: e.message,
      });
    }
  };

  onCreate = async ({ type, value, ttl }) => {
    let { records } = this.state;

    // If record type of CNAME
    if (type === RECORD_TYPE.CNAME) {
      if (records.filter(record => record.type === type).length) {
        records = records.map(record => record.type === type ? { type, value } : record);
      }
    } else {
      records.push({ type, value });
    }
    const newRecords = serializeResource(deserializeResource(records));
    this.setState({ records: newRecords });
    if (ttl != null) {
      this.setState({ ttl });
    }
  };

  onRemove = i => {
    let newRecords = this.state.records.filter((n, j) => i !== j);
    newRecords = serializeResource(deserializeResource(newRecords));
    this.setState({ records: newRecords });
  };

  makeOnEdit = i => async ({ type, value, ttl }) => {
    let { records } = this.state;

    // If record type of CNAME
    if (type === RECORD_TYPE.CNAME) {
      if (records.filter(record => record.type === type).length) {
        records = records.map(record => record.type === type ? { type, value } : record);
      }
    } else {
      records[i] = { type, value };
    }
    const newRecords = serializeResource(deserializeResource(records));
    this.setState({ records: newRecords });
    if (ttl != null) {
      this.setState({ ttl });
    }
  };

  renderRows() {
    const { name, resource } = this.props;
    const { records, ttl } = this.state;

    return records.map((record, i) => {
      const { type, value } = record;
      return (type && value) && (
        <EditableRecord
          key={`${name}-${type}-${value}-${i}`}
          name={name}
          record={record}
          ttl={ttl || resource.ttl}
          onEdit={this.makeOnEdit(i)}
          onRemove={() => this.onRemove(i)}
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
      serializeResource(resource);
      return {
        resource,
        records: serializeResource(resource),
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

function getPendingData(domain) {
  if (!domain) {
    return '';
  }

  if (domain.pendingOperation === 'UPDATE') {
    return domain.pendingOperationMeta.data;
  }

  return '';
}
