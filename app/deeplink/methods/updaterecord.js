import { history, store } from '../../store/configureStore';
import { setDeeplinkParams } from '../../ducks/app';

export default message => {
  const url = new URL(message);
  const params = url.searchParams;
  const name = params.get('name');
  const txt = params.get('txt');

  if (txt) {
    store.dispatch(setDeeplinkParams({ txt }));
  }
  history.push(`/domain_manager/${name}`);
};
