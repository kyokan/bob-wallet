import React, { Component } from 'react';
import { HeaderItem, HeaderRow, Table, TableRow } from '../Table';
import Blocktime from '../../components/Blocktime';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import cn from 'classnames';
import { Resource } from 'hsd/lib/dns/resource';
import Network from 'hsd/lib/protocol/network';
import CreateRecord from './CreateRecord';
import Record from './Record';
import EditableRecord from './EditableRecord';
import * as nameActions from '../../ducks/names';
import deepEqual from 'deep-equal';
import * as logger from '../../utils/logClient';
import { showSuccess } from '../../ducks/notifications';
import { clientStub as aClientStub } from '../../background/analytics/client';
import './records.scss';
import {clearDeeplinkParams} from "../../ducks/app";
import {deserializeRecord} from '../../utils/recordHelpers'
import {I18nContext} from "../../utils/i18n";

const analytics = aClientStub(() => require('electron').ipcRenderer);

const DEFAULT_RESOURCE = {
  __isDefault__: true,
  records: [],
};

export class Records extends Component {
  static contextType = I18nContext;

  static propTypes = {
    name: PropTypes.string.isRequired,
    resource: PropTypes.object,
    pendingData: PropTypes.object,
    deeplinkParams: PropTypes.object.isRequired,
    showSuccess: PropTypes.func.isRequired,
    sendUpdate: PropTypes.func.isRequired,
    clearDeeplinkParams: PropTypes.func.isRequired,
    transferring: PropTypes.bool.isRequired,
    editable: PropTypes.bool,
  };

  shouldComponentUpdate(nextProps, nextState, nextContext) {
    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState);
  }

  constructor(props) {
    super(props);
    this.state = {
      isUpdating: false,
      errorMessage: '',
      updatedResource: DEFAULT_RESOURCE,
    };
  }

  static getDerivedStateFromProps(props, state) {
    let updatedResource = JSON.parse(JSON.stringify(state.updatedResource));
    const isDefault = updatedResource.__isDefault__;

    if (isDefault) {
      if (props.resource) {
        updatedResource = props.resource;
      }
    }

    if (!!Object.keys(props.deeplinkParams).length && props.domain && props.domain.isOwner) {
      props.clearDeeplinkParams();

      if (props.resource) {
        updatedResource = props.resource;
      }

      const {raw, ...params} = props.deeplinkParams

      if (raw) {
        const { records } = Resource.decode(new Buffer(raw, 'hex')).toJSON();
        updatedResource.records.push(...records);
      }

      Object.entries(params)
        .forEach(([type, value]) => {
          const record = deserializeRecord({type: type.toUpperCase(), value});
          updatedResource.records.push(record)
        })

      return {
        ...state,
        updatedResource: updatedResource,
      };
    }

    if (isDefault) {
      return {
        ...state,
        updatedResource: updatedResource,
      };
    }

    return state;
  }

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

    return !deepEqual(oldResource, updatedResource);
  };

  sendUpdate = async () => {
    const {t} = this.context;
    this.setState({isUpdating: true});
    try {
      const {updatedResource} = this.state;
      const res = await this.props.sendUpdate(this.props.name, updatedResource);
      this.setState({isUpdating: false});
      if (res !== null) {
        this.props.showSuccess(t('updateSuccess'));
        analytics.track('updated domain');
      }
    } catch (e) {
      logger.error(`Error received from Records.js - sendUpdate\n\n${e.message}\n${e.stack}\n`);
      this.setState({
        isUpdating: false,
        errorMessage: e.message,
      });
    }
  };

  onCreate = async (record) => {
    const updatedResource = JSON.parse(JSON.stringify(this.state.updatedResource));
    updatedResource.records.push(record);
    this.setState({
      updatedResource,
    });
  };

  onRemove = i => {
    const updatedResource = JSON.parse(JSON.stringify(this.state.updatedResource));
    updatedResource.records.splice(i, 1);
    this.setState({
      updatedResource,
    });
  };

  makeOnEdit = i => async (record) => {
    const updatedResource = JSON.parse(JSON.stringify(this.state.updatedResource));
    updatedResource.records[i] = record;
    this.setState({
      updatedResource,
    });
  };

  renderRows() {
    const resource = this.state.updatedResource;
    const oldResource = this.props.resource;

    if (this.props.editable) {
      return resource.records.map((record, i) => {
        const oldrecord = oldResource && oldResource.records[i];
        return (
          <EditableRecord
            key={`${this.props.name}-${record.type}-${i}`}
            className={deepEqual(oldrecord, record) ? '' : 'edited-record'}
            name={this.props.name}
            record={record}
            onEdit={this.makeOnEdit(i)}
            onRemove={() => this.onRemove(i)}
            disabled={!this.props.domain || !this.props.domain.isOwner}
          />
        );
      });

    } else {
      const records = (this.props.resource && this.props.resource.records) || [];
      return records.map((record, i) => {
        return (
          <Record
            key={`${this.props.name}-${record.type}-${i}`}
            className="domain-detail-records"
            name={this.props.name}
            record={record}
          />
        );
      });
    }
  }

  renderCreateRecord() {
    return (
      <CreateRecord
        name={this.props.name}
        onCreate={this.onCreate}
        disabled={!this.props.domain || !this.props.domain.isOwner}
      />
    );
  }

  renderActionRow() {
    return (this.props.domain && this.props.domain.isOwner) && (
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
          onClick={() => this.setState({updatedResource: DEFAULT_RESOURCE})}
          disabled={!this.hasChanged() || this.state.isUpdating}
        >
          Discard Changes
        </button>
      </TableRow>
    );
  }

  renderPendingUpdateOverlay() {
    const {t} = this.context;
    return (
      <div className="records-table__pending-overlay">
        <div className="records-table__pending-overlay__content">{t('updatingRecords')}</div>
      </div>
    );
  }

  renderTransferringOverlay() {
    const {t} = this.context;
    return (
      <div className="records-table__pending-overlay">
        <div className="records-table__pending-overlay__content">{t('updateDuringTransfer')}</div>
      </div>
    );
  }

  renderTreeUpdateInfo() {
    const {t} = this.context;
    const { currentHeight } = this.props;
    const network = Network.get(this.props.network);
    const { treeInterval } = network.names;

    // Next Tree Update Block (w.r.t. current height)
    let block = currentHeight + (treeInterval - (currentHeight % treeInterval));
    let text = 'treeUpdateGeneric';

    // If last transaction was an UPDATE, then relative block
    const { height, covenant } = this.props.domain?.lastTx || {};
    if (
      height &&
      (covenant.action === 'UPDATE' || covenant.action === 'REGISTER')
    ) {
      block = height + (treeInterval - (height % treeInterval));

      text =
        currentHeight < block
          ? 'treeUpdateFuture'
          : 'treeUpdatePast';
    }

    return (
      <div className="tree-update">
        {t(text)} {block} (<Blocktime height={block} fromNow prefix />)
      </div>
    );
  }

  renderHeaders() {
    return (
      <HeaderRow>
        <HeaderItem>
          <div>Type</div>
        </HeaderItem>
        <HeaderItem>
          Value
        </HeaderItem>
        <HeaderItem>
          {this.renderTreeUpdateInfo()}
        </HeaderItem>
      </HeaderRow>
    );
  }

  render() {
    const {t} = this.context;
    const {
      editable,
      pendingData,
      transferring,
      domain = {},
      resource
    } = this.props;

    if (!editable && (!resource || !resource.records.length)) {
      return <div className="auction-panel__header__content">{t('none')}</div>
    }


    return (
      <div>
        <Table
          className={cn('records-table', {
            'records-table--pending': pendingData,
          })}
        >
          {this.renderHeaders()}
          {this.renderRows()}
          {(!pendingData && editable) ? this.renderCreateRecord() : null}
          {(!pendingData && editable) ? this.renderActionRow() : null}
          {pendingData ? this.renderPendingUpdateOverlay() : null}
          {transferring || domain.pendingOperation === 'TRANSFER' ? this.renderTransferringOverlay() : null}
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
      const deeplinkParams = state.app.deeplinkParams;

      return {
        domain,
        resource,
        pendingData: getPendingData(domain),
        currentHeight: state.node.chain.height,
        network: state.wallet.network,
        deeplinkParams,
      };
    },
    dispatch => ({
      sendUpdate: (name, json) => dispatch(nameActions.sendUpdate(name, json)),
      showSuccess: (message) => dispatch(showSuccess(message)),
      clearDeeplinkParams: () => dispatch(clearDeeplinkParams()),
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

  return {
    records: [],
    ...Resource.decode(new Buffer(data, 'hex')).toJSON(),
  };
}

function getPendingData(domain) {
  if (!domain) {
    return null;
  }

  if (domain.pendingOperation === 'UPDATE' || domain.pendingOperation === 'REGISTER') {
    return getDecodedResource({
      info: {
        data: domain.pendingOperationMeta.data,
      },
    });
  }

  return null;
}
