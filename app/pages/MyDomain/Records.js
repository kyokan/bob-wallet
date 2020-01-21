import React, { Component } from 'react';
import { HeaderItem, HeaderRow, Table, TableRow } from '../../components/Table';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import connect from 'react-redux/es/connect/connect';
import cn from 'classnames';
import Resource from '../../../node_modules/hsd/lib/dns/resource';
import CreateRecord from './CreateRecord';
import EditableRecord from './EditableRecord';
import * as nameActions from '../../ducks/names';
import { deepEqual } from '../../utils/helpers';
import * as logger from '../../utils/logClient';
import { showSuccess } from '../../ducks/notifications';
import { deserializeResource, serializeResource } from '../../utils/recordHelpers';
import { clientStub as aClientStub } from '../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

const {RECORD_TYPE} = nameActions;

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
    );
  }

  state = {
    isUpdating: false,
    errorMessage: '',
    updatedResource: null,
  };

  hasChanged = () => {
    const oldResource = this.props.resource;
    const updatedResource = this.state.updatedResource;

    if (!oldResource && !updatedResource) {
      return false;
    }

    if (!oldResource && updatedResource) {
      return true;
    }

    if (oldResource && !updatedResource) {
      return false;
    }

    return !deepEqual(oldResource.getJSON(), updatedResource.getJSON());
  };

  sendUpdate = async () => {
    this.setState({isUpdating: true});
    try {
      const {updatedResource} = this.state;
      const json = updatedResource.toJSON();
      await this.props.sendUpdate(this.props.name, json);
      this.setState({isUpdating: false});
      // console.log({ json })
      this.props.showSuccess('Your update request is sent successfully! It should be confirmed in 15 minutes.');
      analytics.track('updated domain');
    } catch (e) {
      logger.error(`Error received from Records.js - sendUpdate\n\n${e.message}\n${e.stack}\n`);
      this.setState({
        isUpdating: false,
        errorMessage: e.message,
      });
    }
  };

  onCreate = async ({type, value, ttl}) => {
    const {resource} = this.props;
    const {updatedResource} = this.state;
    let records = serializeResource(updatedResource || resource);
    let newTTL;

    if (resource) {
      newTTL = resource.ttl;
    }

    if (updatedResource) {
      newTTL = updatedResource.ttl;
    }

    if (ttl) {
      newTTL = ttl;
    }

    if (type === RECORD_TYPE.CNAME && hasCNAME(records)) {
      records = records
        .map(record => (
          record.type === type
            ? {type, value}
            : record
        ));
    } else {
      records.push({type, value});
    }

    this.setState({
      updatedResource: deserializeResource(records, newTTL),
    });
  };

  onRemove = i => {
    const {resource} = this.props;
    const {updatedResource} = this.state;

    let ttl;

    if (resource) {
      ttl = resource.ttl;
    }

    if (updatedResource) {
      ttl = updatedResource.ttl;
    }

    let records = serializeResource(updatedResource || resource);

    records = records.filter((n, j) => i !== j);

    this.setState({
      updatedResource: deserializeResource(records, ttl),
    });
  };

  makeOnEdit = i => async ({type, value, ttl}) => {
    const {resource} = this.props;
    const {updatedResource} = this.state;
    let records = serializeResource(updatedResource || resource);
    let newTTL;

    if (resource) {
      newTTL = resource.ttl;
    }

    if (updatedResource) {
      newTTL = updatedResource.ttl;
    }

    if (ttl) {
      newTTL = ttl;
    }

    if (type === RECORD_TYPE.CNAME && hasCNAME(records)) {
      records = records.filter((n, j) => i !== j);
      records.push({type, value});
    } else {
      records[i] = {type, value};
    }

    this.setState({
      updatedResource: deserializeResource(records, newTTL),
    });
  };

  renderRows() {
    const {name, resource, pendingData} = this.props;
    const {updatedResource} = this.state;
    const records = serializeResource(pendingData || updatedResource || resource);

    let ttl;

    if (resource) {
      ttl = resource.ttl;
    }

    if (updatedResource) {
      ttl = updatedResource.ttl;
    }

    if (pendingData) {
      ttl = pendingData.ttl;
    }

    return records.map(({type, value}, i) => {
      return (
        <EditableRecord
          key={`${name}-${type}-${value}-${i}`}
          name={name}
          record={{type, value}}
          ttl={ttl}
          onEdit={this.makeOnEdit(i)}
          onRemove={() => this.onRemove(i)}
        />
      );
    });
  }

  renderCreateRecord() {
    return <CreateRecord name={this.props.name} onCreate={this.onCreate} />;
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
          onClick={() => this.setState({updatedResource: null})}
          disabled={!this.hasChanged() || this.state.isUpdating}
        >
          Discard Changes
        </button>
      </TableRow>
    );
  }

  renderPendingUpdateOverlay() {
    return (
      <div className="records-table__pending-overlay">
        <div className="records-table__pending-overlay__content">Updating records...</div>
      </div>
    );
  }

  render() {
    return (
      <div>
        <Table
          className={cn('records-table', {
            'records-table--pending': this.props.pendingData,
          })}
        >
          {Records.renderHeaders()}
          {this.renderRows()}
          {!this.props.pendingData ? this.renderCreateRecord() : null}
          {!this.props.pendingData ? this.renderActionRow() : null}
          {this.props.pendingData ? this.renderPendingUpdateOverlay() : null}
        </Table>
      </div>
    );
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
      };
    },
    dispatch => ({
      sendUpdate: (name, json) => dispatch(nameActions.sendUpdate(name, json)),
      showSuccess: (message) => dispatch(showSuccess(message)),
    }),
  )(Records),
);

function getDecodedResource(domain) {
  const {info} = domain || {};

  if (!info) {
    return;
  }

  const {data} = info;

  if (!data) {
    return;
  }

  return Resource.decode(new Buffer(data, 'hex'));
}

function getPendingData(domain) {
  if (!domain) {
    return '';
  }

  if (domain.pendingOperation === 'UPDATE' || domain.pendingOperation === 'REGISTER') {
    return getDecodedResource({
      info: {
        data: domain.pendingOperationMeta.data,
      },
    });
  }

  return '';
}

function hasCNAME(records) {
  return !!records.filter(({type}) => type === RECORD_TYPE.CNAME).length;
}
