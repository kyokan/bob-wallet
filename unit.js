import 'react-16-node-hanging-test-fix';

import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() });

require('./app/pages/Auction/tests/RepairBid.spec');
require('./app/pages/MyDomain/tests/Records.spec');
