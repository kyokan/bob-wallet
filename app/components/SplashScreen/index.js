import React, { Component } from 'react';
import Proptype from 'prop-types';
import BobLogo from '../../assets/images/bob-logo-circle.svg';
import Spinner from '../../assets/images/brick-loader.svg';
import dbClient from "../../utils/dbClient";
import Alert from "../Alert";
import {withRouter} from "react-router-dom";
import {connect} from "react-redux";
import {I18nContext} from "../../utils/i18n";


class SplashScreen extends Component {
  static propTypes = {
    error: Proptype.string,
    network: Proptype.string,
    spv: Proptype.bool,
    compactingTree: Proptype.bool,
  };

  static defaultProps = {
    error: '',
  };

  static contextType = I18nContext;

  state = {
    hasMigrated400: false,
  };

  async componentDidMount() {
    // TODO: `network` is ALWAYS 'main' here. I think that is because
    // this code runs before any of the background stuff has a chance
    // to update state with user's actual configuration. This is only an
    // issue for developers because we will see the splash screen for a moment
    // on every boot in regtest until state.network is updated.
    const {network, spv} = this.props;
    const migrateFlag = `${network}-hsd-4.0.0-migrate${spv ? '-spv' : ''}`;
    const hasMigrated400 = await dbClient.get(migrateFlag);
    this.setState({ hasMigrated400 });
  }

  render() {
    const {error} = this.props;
    const {t} = this.context;

    return (
      <div style={wrapperStyle}>
        <div style={logoWrapperStyle}>
          <div style={bobLogoStyle} />
        </div>
        {
          error
            ? <div style={textStyles}> {error} </div>
            : (
              <React.Fragment>
                <div style={spinnerStyle} />
                <div style={textStyles}>{t('splashLoading')}</div>
                { this.renderAlert(t) }
              </React.Fragment>
            )
        }
      </div>
    );
  }

  renderAlert(t) {
    // Tree compaction alert takes precedence
    if (this.props.compactingTree) {
      return (
        <Alert type="warning" style={alertStyle}>
          <div>
            {t('compactingTree1')}
          </div>
          <div>
            {t('compactingTree2')}
          </div>
        </Alert>
      );
    }

    if (!this.state.hasMigrated400) {
      return(
        <Alert type="warning" style={alertStyle}>
          <div>
            {
              // Technically the version is now 4.0.0 not 3.0.0
              // but the atual text in the message is version
              // agnostic ("migration in progress...")
              // so we can probably just leave this as is.
              t('splashMigrate3001')
            }
          </div>
          <div>
            {t('splashMigrate3002')}
          </div>
        </Alert>
      )
    }
  }
}

export default withRouter(
  connect(
    (state) => ({
      network: state.node.network,
      spv: state.node.spv,
      compactingTree: state.node.compactingTree,
    }),
  )(SplashScreen)
);

const wrapperStyle = {
  display: 'flex',
  flexFlow: 'column nowrap',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
};

const logoWrapperStyle = {
  display: 'flex',
  flexFlow: 'row nowrap',
  justifyContent: 'center',
  alignItems: 'baseline',
  margin: '3rem 0',
};

const bobLogoStyle = {
  backgroundImage: `url(${BobLogo})`,
  height: '75px',
  width: '75px',
  backgroundSize: 'contain',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  animation: '0.5s ease-in-out',
};

const spinnerStyle = {
  backgroundImage: `url(${Spinner})`,
  marginBottom: '15px',
  height: '1.5rem',
  width: '1.5rem',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  animation: '0.5s ease-in-out',
};

const textStyles = {
  fontSize: '1rem',
  lineHeight: '1rem * 1.4',
  color: '#909095',
  maxWidth: '300px',
};

const alertStyle = {
  marginTop: '1rem',
  width: '24rem',
  textAlign: 'center',
};
