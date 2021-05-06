import { history, store } from '../../store/configureStore';
import { setDeeplinkParams } from '../../ducks/app';
import * as qs from 'querystring';

export default message => {
  const url = new URL(message);
  const { name, ...params } = qs.parse(url.searchParams.toString());

  store.dispatch(setDeeplinkParams(params));
  history.push(`/domain_manager/${name}`);
};
