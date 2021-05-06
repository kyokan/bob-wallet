import { history } from '../../store/configureStore';

export default message => {
  const name = new URL(message).searchParams.get('name');

  history.push(`/domain/${name}`);
};
