import React, { Component } from 'react';
import Proptype from 'prop-types';
import Alice from "../../assets/images/alice.png";
import Bob from "../../assets/images/the-cat.png";
import Spinner from "../../assets/images/brick-loader.svg";

export default class SplashScreen extends Component {
  static propTypes = {
    error: Proptype.string
  }

  static defaultProps = {
    error: ''
  }

  render() {
    const { error } = this.props;

    const wrapperStyle = {
      display: 'flex',
      flexFlow: 'column nowrap',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }

    const titleStyle = {
      fontSize: '2rem',
      fontWeight: 500,
      textTransform: 'capitalize',
    }

    const logoWrapperStyle = {
      display: 'flex',
      flexFlow: 'row nowrap',
      justifyContent: 'center',
      alignItems: 'baseline',
      margin: '3rem 0',
    }

    const aliceLogoStyle = {
      backgroundImage: `url(${Alice})`,
      height: '219px',
      width: '130px',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      animation: '0.5s ease-in-out',
    }

    const bobLogoStyle = {
      backgroundImage: `url(${Bob})`,
      height: '109px',
      width: '75px',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      animation: '0.5s ease-in-out',
    }

    const spinnerStyle = {
      backgroundImage: `url(${Spinner})`,
      marginBottom: '15px',
      height: '1.5rem',
      width: '1.5rem',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      animation: '0.5s ease-in-out',
    }

    const textStyles = {
        fontSize: '1rem',
        lineHeight: '1rem * 1.4',
        color: '#909095',
    }

    return (
      <div style={ wrapperStyle }>
        <div style={ titleStyle }> 
          Allison x Bob
        </div>
        <div style={ logoWrapperStyle }>
          <div style={ aliceLogoStyle }/>
          <div style={ bobLogoStyle } />
        </div>
        {error ? <div style={ textStyles }> { error } </div> :  (
          <React.Fragment>
            <div style={ spinnerStyle } />
            <div style={ textStyles }>Loading node...</div>
          </React.Fragment>
          )
        }
      </div>
    )
  }
}