import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import moment from 'moment';
import * as names from '../../ducks/names';
import './my-domain.scss';
import Collapsible from '../../components/Collapsible';
import DomainDetails from './DomainDetails';
import Records from './Records';
import BidHistory from '../Auction/BidHistory';
import { showError, showSuccess } from '../../ducks/notifications';

class MyDomain extends Component {
  static propTypes = {
    domain: PropTypes.object,
    chain: PropTypes.object,
    name: PropTypes.string.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func,
    }).isRequired,
    showError: PropTypes.func.isRequired,
    showSuccess: PropTypes.func.isRequired,
    sendRenewal: PropTypes.func.isRequired,
  };

  componentWillMount() {
    this.props.getNameInfo();
  }

  handleRenew = () => {
    this.props.sendRenewal(this.props.name)
      .then(() => this.props.showSuccess('Your renew request is submitted! Please wait around 15 minutes for it to be confirmed.'))
      .catch(e => this.props.showError(e.message))
  };

  renderRenewal() {
    const { chain } = this.props;
    const domain = this.props.domain || {};
    const info = domain.info || {};
    const stats = info.stats || {};

    if (!stats.renewalPeriodStart) {
      return;
    }

    if (chain && (chain.height < stats.renewalPeriodStart)) {
      return;
    }

    if (domain.pendingOperation === 'RENEW') {
      return (
        <div
          className="my-domain__header__renewing-link"
        >
          Renewing...
        </div>
      )
    }

    return (
      <div
        className="my-domain__header__reveal-link"
        onClick={this.handleRenew}
      >
        Send Renewal
      </div>
    )
  }

  render() {
    const { name, history } = this.props;

    return (
      <div className="my-domain">
        <div
          className="my-domain__back-arrow"
          onClick={() => history.push('/domain_manager')}
        >
          Back
        </div>
        <div className="my-domain__header">
          <div className="my-domain__header__title">{`${name}/`}</div>
          <div className="my-domain__header__expires-text">
            { this.renderExpireText() }
          </div>
          { this.renderRenewal() }
        </div>
        <Collapsible  className="my-domain__info-panel" title="Domain Details" defaultCollapsed>
          <DomainDetails name={name} />
        </Collapsible>
        <Collapsible  className="my-domain__info-panel" title="Records">
          <Records  name={name} />
        </Collapsible>
        <Collapsible  className="my-domain__info-panel" title="Bid History" defaultCollapsed>
          {
            this.props.domain
              ? <BidHistory bids={this.props.domain.bids} reveals={this.props.domain.reveals}/>
              : 'Loading...'
          }
        </Collapsible>
      </div>
    )
  }

  renderExpireText() {
    const { domain } = this.props;

    if (!domain || !domain.info || !domain.info.stats) {
      return;
    }

    const expired = moment().add(domain.info.stats.daysUntilExpire, 'd').format('YYYY-MM-DD');

    return `Expires ${expired}`;

  }
}

export default withRouter(
  connect(
    ((state, ownProps) => ({
      name: ownProps.match.params.name,
      domain: state.names[ownProps.match.params.name],
      chain: state.node.chain,
    })),
    (dispatch, ownProps) => ({
      getNameInfo: () => dispatch(names.getNameInfo(ownProps.match.params.name)),
      sendRenewal: tld => dispatch(names.sendRenewal(tld)),
      showSuccess: (message) => dispatch(showSuccess(message)),
      showError: (message) => dispatch(showError(message)),
    })
  )(MyDomain)
);
