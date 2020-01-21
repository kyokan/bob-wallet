import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import TLDInput from '../../components/TLDInput';
import './searchTLD.scss';
import { clientStub as aClientStub } from '../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

@withRouter
class SearchTLD extends Component {
  componentDidMount() {
    analytics.screenView('Search TLD');
  }

  render() {
    return (
      <div className="search_tld">
        <div className="search_tld__headline">Search a top-level domain</div>
        <TLDInput greyTheme />
      </div>
    );
  }
}

export default SearchTLD;
