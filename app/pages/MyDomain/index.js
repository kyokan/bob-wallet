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

class MyDomain extends Component {
  static propTypes = {
    domain: PropTypes.object,
    name: PropTypes.string.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func,
    }).isRequired,
  };

  componentWillMount() {
    this.props.getNameInfo();
  }

  render() {
    const { name, history, domain } = this.props;

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
          <div className="my-domain__header__reveal-link">
            Send Renewal
          </div>
        </div>
        <Collapsible  className="my-domain__info-panel" title="Domain Details" defaultCollapsed>
          <DomainDetails name={name} />
        </Collapsible>
        <Collapsible  className="my-domain__info-panel" title="Records">
          <Records  name={name} />
        </Collapsible>
        <Collapsible  className="my-domain__info-panel" title="Bid History" defaultCollapsed>
          hi
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
    })),
    (dispatch, ownProps) => ({
      getNameInfo: () => dispatch(names.getNameInfo(ownProps.match.params.name)),
    })
  )(MyDomain)
);
