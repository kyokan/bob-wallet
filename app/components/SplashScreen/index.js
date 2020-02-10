import React, { Component } from 'react';
import Proptype from 'prop-types';
import BobLogo from '../../assets/images/bob-logo-circle.svg';
import Spinner from '../../assets/images/brick-loader.svg';

export default class SplashScreen extends Component {
  static propTypes = {
    error: Proptype.string,
  };

  static defaultProps = {
    error: '',
  };

  render() {
    const {error} = this.props;

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

    return (
      <div style={wrapperStyle}>
        <div style={logoWrapperStyle}>
          <div style={bobLogoStyle} />
        </div>
        {error ? <div style={textStyles}> {error} </div> : (
          <React.Fragment>
            <div style={spinnerStyle} />
            <div style={textStyles}>Loading node...</div>
          </React.Fragment>
        )
        }
      </div>
    );
  }
}
