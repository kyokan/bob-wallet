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
  };

  static defaultProps = {
    error: '',
  };

  static contextType = I18nContext;

  state = {
    hasMigrated300: false,
  };

  async componentWillMount() {
    const {network, spv} = this.props;
    const migrateFlag = `${network}-hsd-3.0.0-migrate${spv ? '-spv' : ''}`;
    const hasMigrated300 = await dbClient.get(migrateFlag);
    this.setState({ hasMigrated300 });
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
                {
                  !this.state.hasMigrated300 && (
                    <Alert type="warning" style={alertStyle}>
                      <div>
                        {t('splashMigrate3001')}
                      </div>
                      <div>
                        {t('splashMigrate3002')}
                      </div>
                    </Alert>
                  )
                }
              </React.Fragment>
            )
        }
      </div>
    );
  }
}

export default withRouter(
  connect(
    (state) => ({
      network: state.node.network,
      spv: state.node.spv,
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
