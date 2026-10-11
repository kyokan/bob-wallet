import {reviewText} from '../../utils/reviewText';
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
import {deserializeRecord, serializeRecord} from '../../utils/recordHelpers';
import {I18nContext} from "../../utils/i18n";
import fs from 'fs';
import ListingForm from '../../addons/shakex/ListingForm';
import Collapsible from '../Collapsible';
import {LISTING_STATUS} from '../../constants/exchange';
import {buildSaleReview} from '../../addons/shakex/records';
import nodeClient from '../../utils/nodeClient';
import {assertCanonicalStillCurrent, parseActivateProposal} from '../../utils/activateProposal';

const {dialog} = require('electron');

const analytics = aClientStub(() => require('electron').ipcRenderer);

const DEFAULT_RESOURCE = {
  records: [],
};

function cloneResource(resource) {
  return resource ? JSON.parse(JSON.stringify(resource)) : null;
}

function makeDefaultResource() {
  return cloneResource(DEFAULT_RESOURCE);
}

export class Records extends Component {
  static contextType = I18nContext;

  mounted = false;
  operations = {};

  componentDidMount() { this.mounted = true; }

  componentWillUnmount() {
    this.mounted = false;
    this.operations = {};
  }

  beginOperation = kind => {
    const operation = {
      kind, revision: this.state.contextRevision,
      name: this.props.name, network: this.props.network,
      wallet: this.props.walletId, generation: this.props.walletGeneration,
    };
    this.operations[kind] = operation;
    return operation;
  };

  isCurrentOperation = operation => this.mounted &&
    this.operations[operation.kind] === operation &&
    this.state.contextRevision === operation.revision &&
    this.props.name === operation.name && this.props.network === operation.network &&
    this.props.walletId === operation.wallet && this.props.walletGeneration === operation.generation;

  assertOperation = operation => {
    if (!this.isCurrentOperation(operation)) throw new Error(this.tr('recordsContextChanged'));
  };

  tr = (key, ...values) => reviewText(this.context.t, key, ...values);

  assertCurrent = (review, hex) => {
    try {
      assertCanonicalStillCurrent(review, hex);
    } catch (error) {
      throw new Error(this.tr('recordsStale'));
    }
  };

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
    network: PropTypes.string.isRequired,
    loadCanonicalNameInfo: PropTypes.func.isRequired,
    refreshCanonicalNameInfo: PropTypes.func.isRequired,
    canonicalLoading: PropTypes.bool,
    canonicalError: PropTypes.string,
    openProposalFile: PropTypes.func.isRequired,
    readProposalFile: PropTypes.func.isRequired,
  };

  shouldComponentUpdate(nextProps, nextState, nextContext) {
    return !deepEqual(this.props, nextProps) || !deepEqual(this.state, nextState);
  }

  constructor(props) {
    super(props);
    const canonicalResource = cloneResource(props.resource);
    this.state = {
      contextRevision: 0,
      isUpdating: false,
      errorMessage: '',
      updatedResource: canonicalResource || makeDefaultResource(),
      canonicalResource,
      resourceName: props.name,
      resourceWallet: props.walletId,
      resourceGeneration: props.walletGeneration,
      resourceNetwork: props.network,
      isDirty: false,
      isRefreshingRecords: false,
      refreshError: '',
      importReview: null,
      isImporting: false,
      saleProvider: null,
    };
  }

  static getDerivedStateFromProps(props, state) {
    const nameChanged = props.name !== state.resourceName || props.walletId !== state.resourceWallet || props.walletGeneration !== state.resourceGeneration || props.network !== state.resourceNetwork;
    const canonicalChanged = !deepEqual(props.resource || null, state.canonicalResource);
    let nextState = null;

    if (nameChanged) {
      const canonicalResource = cloneResource(props.resource);
      nextState = {
        contextRevision: state.contextRevision + 1,
        isUpdating: false,
        isImporting: false,
        saleProvider: null,
        isRefreshingRecords: false,
        errorMessage: '',
        resourceName: props.name,
        resourceWallet: props.walletId,
        resourceGeneration: props.walletGeneration,
        resourceNetwork: props.network,
        canonicalResource,
        updatedResource: canonicalResource || makeDefaultResource(),
        isDirty: false,
        refreshError: '',
        importReview: null,
      };
    } else if (canonicalChanged) {
      const canonicalResource = cloneResource(props.resource);
      nextState = {
        canonicalResource,
        ...(!state.isDirty ? {
          updatedResource: canonicalResource || makeDefaultResource(),
        } : {}),
      };
    }

    if (!!Object.keys(props.deeplinkParams).length && props.domain && props.domain.isOwner) {
      props.clearDeeplinkParams();
      const baseResource = cloneResource(
        (nextState && nextState.updatedResource) || state.updatedResource || props.resource
      ) || makeDefaultResource();

      const {raw, ...params} = props.deeplinkParams

      if (raw) {
        const { records } = Resource.decode(new Buffer(raw, 'hex')).toJSON();
        baseResource.records.push(...records);
      }

      Object.entries(params)
        .forEach(([type, value]) => {
          const record = deserializeRecord({type: type.toUpperCase(), value});
          baseResource.records.push(record)
        })

      return {
        ...(nextState || {}),
        updatedResource: baseResource,
        isDirty: true,
      };
    }

    return nextState;
  }

  hasChanged = () => {
    const oldResource = this.props.resource;
    const updatedResource = this.state.updatedResource;

    return !deepEqual(oldResource || DEFAULT_RESOURCE, updatedResource || DEFAULT_RESOURCE);
  };

  sendUpdate = async () => {
    if (!this.mounted || this.state.isUpdating) return;
    const operation = this.beginOperation('submit');
    const {updatedResource, importReview: review} = this.state;
    const assertContext = () => this.assertOperation(operation);
    const assertSaleAvailable = () => {
      assertContext();
      if (!this.props.domain?.isOwner || this.props.pendingData || this.props.transferring || this.props.domain.pendingOperation) {
        throw new Error(this.tr('recordsUnavailable'));
      }
    };
    const recheckSale = review?.kind === 'shakex' ? async () => {
      assertSaleAvailable();
      const latest = await this.props.loadCanonicalNameInfo(operation.name);
      assertSaleAvailable();
      if (!latest?.info || latest.info.transfer || latest.info.revoked) throw new Error(this.tr('recordsUnavailable'));
      this.assertCurrent(review, latest.info.data || '00');
    } : undefined;
    this.setState({isUpdating: true, errorMessage: ''});
    try {
      if (review?.kind === 'shakex') assertSaleAvailable();
      if (review) {
        const result = await this.props.loadCanonicalNameInfo(operation.name);
        assertContext();
        if (!result?.info) throw new Error(this.tr('recordsReloadFailed'));
        if (review.kind === 'shakex' && (result.info.transfer || result.info.revoked)) {
          throw new Error(this.tr('recordsTransferring'));
        }
        this.assertCurrent(review, result.info.data || '00');
      }
      assertContext();
      // The synchronous guard also runs immediately before the host wallet call,
      // after its unlock, review and local-storage awaits have completed.
      const res = await this.props.sendUpdate(operation.name, updatedResource, recheckSale,
        review?.kind === 'shakex' ? assertSaleAvailable : assertContext);
      if (!this.isCurrentOperation(operation)) return;
      this.setState({
        isUpdating: false,
        ...(res !== null ? {isDirty: false, importReview: null} : {}),
      });
      if (res !== null) {
        this.props.showSuccess(this.context.t('updateSuccess'));
        analytics.track('updated domain');
      }
    } catch (e) {
      if (!this.isCurrentOperation(operation)) return;
      logger.error(`Error received from Records.js - sendUpdate\n\n${e.message}\n${e.stack}\n`);
      this.setState({isUpdating: false, errorMessage: e.message});
    } finally {
      if (this.operations.submit === operation) delete this.operations.submit;
    }
  };

  onCreate = async (record) => {
    const updatedResource = JSON.parse(JSON.stringify(this.state.updatedResource));
    updatedResource.records.push(record);
    this.setState({
      updatedResource,
      isDirty: true,
      importReview: null,
    });
  };

  onRemove = i => {
    const updatedResource = JSON.parse(JSON.stringify(this.state.updatedResource));
    updatedResource.records.splice(i, 1);
    this.setState({
      updatedResource,
      isDirty: true,
      importReview: null,
    });
  };

  makeOnEdit = i => async (record) => {
    const updatedResource = JSON.parse(JSON.stringify(this.state.updatedResource));
    updatedResource.records[i] = record;
    this.setState({
      updatedResource,
      isDirty: true,
      importReview: null,
    });
  };

  refreshRecords = async () => {
    if (!this.mounted || this.state.isDirty || this.state.isRefreshingRecords) return;
    const operation = this.beginOperation('refresh');
    this.setState({isRefreshingRecords: true, refreshError: ''});
    try {
      await this.props.refreshCanonicalNameInfo(operation.name);
      if (this.isCurrentOperation(operation)) this.setState({isRefreshingRecords: false});
    } catch (error) {
      if (!this.isCurrentOperation(operation)) return;
      logger.error(`Error received from Records.js - refreshRecords\n\n${error.message}\n${error.stack}\n`);
      this.setState({isRefreshingRecords: false, refreshError: error.message || this.tr('recordsRefreshFailed')});
    } finally {
      if (this.operations.refresh === operation) delete this.operations.refresh;
    }
  };

  onStageSale = async options => {
    if (!this.mounted) return;
    if (!this.props.domain?.isOwner || this.props.pendingData || this.props.transferring ||
        this.props.domain.pendingOperation || this.state.isDirty || this.state.isUpdating || this.state.isImporting) {
      this.setState({errorMessage: this.tr('shakexPendingOrDirty')});
      return;
    }
    const operation = this.beginOperation('draft');
    this.setState({isImporting: true, errorMessage: ''});
    try {
      const result = await this.props.loadCanonicalNameInfo(operation.name);
      if (!this.isCurrentOperation(operation)) return;
      if (!result?.info || !this.props.domain?.isOwner || this.props.domain.pendingOperation || this.props.transferring || this.props.pendingData) {
        throw new Error(this.tr('recordsUpdateUnavailable'));
      }
      if (result.info.transfer || result.info.revoked) throw new Error(this.tr('recordsTransferring'));
      const importReview = buildSaleReview(result.info.data || '00', options, this.context.t);
      this.setState({importReview, updatedResource: importReview.afterResource, isDirty: true});
    } catch (error) {
      if (this.isCurrentOperation(operation)) this.setState({errorMessage: error.message});
    } finally {
      if (this.isCurrentOperation(operation)) this.setState({isImporting: false});
      if (this.operations.draft === operation) delete this.operations.draft;
    }
  };

  onImportProposal = async () => {
    if (!this.mounted || this.state.isImporting || this.state.isUpdating) return;
    if (!this.props.domain || !this.props.domain.isOwner) {
      this.setState({errorMessage: this.tr('recordsImportOwnerOnly')});
      return;
    }
    if (this.props.pendingData) {
      this.setState({errorMessage: this.tr('recordsImportPending')});
      return;
    }
    const operation = this.beginOperation('draft');
    this.setState({isImporting: true, errorMessage: ''});
    try {
      const result = await this.props.openProposalFile({
        properties: ['openFile'],
        filters: [{name: this.tr('recordsProposalFile'), extensions: ['json']}],
      });
      if (!this.isCurrentOperation(operation)) return;
      if (result.canceled || !result.filePaths || !result.filePaths[0]) return;
      const contents = await this.props.readProposalFile(result.filePaths[0]);
      if (!this.isCurrentOperation(operation)) return;
      const nameInfo = await this.props.loadCanonicalNameInfo(operation.name);
      if (!this.isCurrentOperation(operation)) return;
      if (!nameInfo?.info) throw new Error(this.tr('recordsLoadFailed'));
      const importReview = parseActivateProposal(contents, {
        expectedName: operation.name,
        expectedNetwork: operation.network,
        currentResourceHex: nameInfo.info.data || '00',
      });
      this.setState({updatedResource: importReview.afterResource, isDirty: true, importReview, errorMessage: ''});
    } catch (error) {
      if (this.isCurrentOperation(operation)) this.setState({errorMessage: error.message});
    } finally {
      if (this.isCurrentOperation(operation)) this.setState({isImporting: false});
      if (this.operations.draft === operation) delete this.operations.draft;
    }
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
            disabled={!this.props.domain || !this.props.domain.isOwner || this.state.isImporting || this.state.importReview?.kind === 'shakex'}
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
        disabled={!this.props.domain || !this.props.domain.isOwner || this.state.isImporting || this.state.importReview?.kind === 'shakex'}
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
          className="records-table__action-row__import-btn"
          disabled={this.state.isImporting || this.state.isUpdating || Boolean(this.props.pendingData) || this.state.importReview?.kind === 'shakex'}
          onClick={this.onImportProposal}
        >
          {this.state.isImporting ? this.tr('recordsImporting') : this.tr('recordsImport')}
        </button>
        <button
          className="records-table__action-row__submit-btn"
          disabled={!this.hasChanged() || this.state.isUpdating || this.state.isImporting}
          onClick={this.sendUpdate}
        >
          {this.tr('recordsSubmit')}
        </button>
        <button
          className="records-table__action-row__dismiss-link"
          onClick={() => this.setState({
            updatedResource: cloneResource(this.props.resource) || makeDefaultResource(),
            isDirty: false,
            importReview: null,
            errorMessage: '',
          })}
          disabled={!this.hasChanged() || this.state.isUpdating || this.state.isImporting}
        >
          {this.tr('recordsDiscard')}
        </button>
      </TableRow>
    );
  }

  renderRefreshStatus() {
    if (!this.props.editable) return null;

    const isRefreshing = this.props.canonicalLoading || this.state.isRefreshingRecords;
    const error = this.state.refreshError || this.props.canonicalError;
    return (
      <div className={cn('records-table__refresh-status', {
        'records-table__refresh-status--error': error,
      })}>
        <div className="records-table__refresh-status__message">
          {error
            ? this.tr('recordsRefreshError', error)
            : isRefreshing
              ? this.tr('recordsRefreshingCanonical')
              : this.state.isDirty
                ? this.tr('recordsPreservedDraft')
                : this.tr('recordsCanonicalNotice')}
        </div>
        <button
          className="records-table__refresh-status__button"
          onClick={this.refreshRecords}
          disabled={this.state.isDirty || isRefreshing || this.state.isUpdating || this.state.isImporting}
        >
          {isRefreshing ? this.tr('recordsRefreshing') : this.tr('recordsRefresh')}
        </button>
      </div>
    );
  }

  renderImportReview() {
    const review = this.state.importReview;
    if (!review) return null;

    const renderResource = (resource, label) => (
      <div className="activate-import-review__resource">
        <h4>{label} <span>{this.tr(resource.records.length === 1 ? 'recordsCountOne' : 'recordsCountMany', resource.records.length)}</span></h4>
        {resource.records.length === 0
          ? <div className="activate-import-review__empty">{this.tr('recordsEmpty')}</div>
          : resource.records.map((record, index) => (
            <div className="activate-import-review__record" key={`${label}-${record.type}-${index}`}>
              <b>{record.type}</b>
              <code>{record.type === 'TXT' ? (record.txt || []).map(value => JSON.stringify(value)).join(' ') : serializeRecord(record)}</code>
            </div>
          ))}
      </div>
    );

    return (
      <section className={cn("activate-import-review", {"activate-import-review--shakex": review.kind === "shakex"})} aria-label={review.kind === "shakex" ? this.tr('shakexReviewAriaLabel') : this.tr('recordsReviewAriaLabel')}>
        <div className="activate-import-review__header">
          <div>
            <strong>{review.kind === 'shakex' ? this.tr('shakexReviewTitle') : this.tr('recordsReviewTitle')}</strong>
            <p>{this.tr('recordsReviewHelp')}</p>
          </div>
          <span>{review.kind === 'shakex' ? this.tr('shakexResourceBytes', review.bytes) : `v${review.proposal.version}`}</span>
        </div>
        <div className="activate-import-review__grid">
          {renderResource(review.beforeResource, this.tr('recordsBefore'))}
          {renderResource(review.afterResource, this.tr('recordsAfter'))}
        </div>
      </section>
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
          <div>{this.tr('recordsType')}</div>
        </HeaderItem>
        <HeaderItem>
          {this.tr('recordsValue')}
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

    const isCanonicalLoading = editable
      && (this.props.canonicalLoading || this.state.isRefreshingRecords)
      && !this.state.isDirty
      && !this.state.updatedResource.records.length;
    const canonicalError = this.state.refreshError || this.props.canonicalError;

    if (!editable && (!resource || !resource.records.length)) {
      return <div className="auction-panel__header__content">{t('none')}</div>
    }

    if (isCanonicalLoading || (editable && canonicalError && !this.state.updatedResource.records.length && !this.state.isDirty)) {
      return this.renderRefreshStatus();
    }

    const records = (
      <div>
        {this.renderRefreshStatus()}
        {this.renderImportReview()}
        <Table
          className={cn('records-table', {
            'records-table--pending': pendingData,
            'records-table--shakex': editable && domain.isOwner,
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
    if (!this.props.sellingOptions) return records;
    return <div>
      <Collapsible className="my-domain__info-panel" title={t('records')} overflowY={false}>
        {records}
      </Collapsible>
      {editable && domain.isOwner && <Collapsible className="my-domain__info-panel" title={t('sellNameTitle')} overflowY={false}>
        {this.renderSellingOptions()}
      </Collapsible>}
    </div>;
  }

  saleDisabled = () => !this.props.domain?.isOwner || !this.props.domain?.info?.registered ||
    this.props.domain.info.revoked || this.props.canonicalLoading || !!this.props.canonicalError ||
    this.state.isDirty || this.state.isImporting || this.state.isUpdating ||
    !!this.props.pendingData || this.props.transferring || !!this.props.domain.pendingOperation;

  chooseSale = provider => {
    if (!this.mounted || this.saleDisabled()) return;
    if (provider === 'shakedex') {
      const listing = (this.props.shakedexListings || []).find(item =>
        item.nameLock?.name === this.props.name &&
        ![LISTING_STATUS.FINALIZE_CANCEL_CONFIRMED, LISTING_STATUS.SOLD].includes(item.status));
      this.props.history.push(listing
        ? `/exchange?listing=${encodeURIComponent(this.props.name)}`
        : `/exchange?createListing=1&name=${encodeURIComponent(this.props.name)}`);
    } else if (provider === 'shakex') {
      this.setState({saleProvider: 'shakex'});
    }
  };

  renderSellingOptions() {
    const {t} = this.context;
    const disabled = this.saleDisabled();
    return <section className="name-selling">
      <div className="name-selling__options">
        <div><h3>Shakedex</h3><p>{t('sellNameShakedexHelp')}</p>
          <button type="button" disabled={disabled} onClick={() => this.chooseSale('shakedex')}>{t('sellNameShakedexAction')}</button>
        </div>
        <div><h3>ShakeX</h3><p>{t('sellNameShakexHelp')}</p>
          <button type="button" disabled={disabled} aria-expanded={this.state.saleProvider === 'shakex'} onClick={() => this.chooseSale('shakex')}>{t('sellNameShakexAction')}</button>
        </div>
      </div>
      {disabled && <p>{t('sellNameUnavailable')}</p>}
      {this.state.saleProvider === 'shakex' && <ListingForm key={this.props.name}
        resource={this.props.resource} disabled={disabled} onStage={this.onStageSale} />}
    </section>;
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
        walletId: state.wallet.wid,
        walletGeneration: state.wallet.requestGeneration || 0,
        shakedexListings: state.exchange.listings,
        deeplinkParams,
      };
    },
    (dispatch, ownProps) => ({
      sendUpdate: (name, json, beforeSend, assertReviewContext) => dispatch(nameActions.sendUpdate(name, json, beforeSend, assertReviewContext)),
      showSuccess: (message) => dispatch(showSuccess(message)),
      clearDeeplinkParams: () => dispatch(clearDeeplinkParams()),
      loadCanonicalNameInfo: name => nodeClient.getNameInfo(name),
      refreshCanonicalNameInfo: ownProps.refreshCanonicalNameInfo
        || (name => dispatch(nameActions.getNameInfo(name))),
      openProposalFile: options => dialog.showOpenDialog(options),
      readProposalFile: path => fs.promises.readFile(path),
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
