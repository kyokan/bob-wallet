import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import TLDInput from '../../components/TLDInput';
import './searchTLD.scss';
import { I18nContext } from "../../utils/i18n";
import { clientStub as aClientStub } from '../../background/analytics/client';

const analytics = aClientStub(() => require('electron').ipcRenderer);

@withRouter
class SearchTLD extends Component {
  static contextType = I18nContext;

  componentDidMount() {
    analytics.screenView('Search TLD');
  }

  render() {
    const {t} = this.context;

    return (
      <div className="search_tld">
        <div className="search_tld__headline">{t('searchInputPlaceholder')}</div>
        <TLDInput greyTheme />
      </div>
    );
  }
}

export default SearchTLD;
