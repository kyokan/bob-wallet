import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import TLDInput from '../../components/TLDInput';
import './searchTLD.scss';

@withRouter
class SearchTLD extends Component {
  render() {
    return (
      <div className="search_tld">
        <div className="search_tld__headline">Search a top-level domain</div>
        <TLDInput />
      </div>
    );
  }
}

export default SearchTLD;
