import React from 'react';
const test = require('tape');
const sinon = require('sinon');
import {mount} from 'enzyme';
import {Records} from "../Records";

test('<Records>', async t => {
  const showSuccess = sinon.stub();
  const sendUpdate = sinon.stub();
  const clearDeeplinkParams = sinon.stub();
  const wrapper = mount(
    <Records
      name="dev"
      domain={{
        name: "dev",
        isOwner: true,
      }}
      deeplinkParams={{

      }}
      showSuccess={showSuccess}
      sendUpdate={sendUpdate}
      clearDeeplinkParams={clearDeeplinkParams}
      transferring={false}
    />,
  );

  t.ok(wrapper, 'should render ok');
  wrapper.setProps({
    resource: {
      records: [
        { type: 'TXT', txt: ['i am a test']},
      ],
    },
  });
  wrapper.update();
  wrapper.setProps({
    deeplinkParams: {
      txt: 'from deeplink'
    },
  });
  wrapper.update();
  const rows = wrapper.find('.table__row');
  t.equal(rows.at(0).find('.table__row__item').at(1).text(), 'i am a test', 'should match props.resource');
  t.equal(rows.at(1).find('.table__row__item').at(1).text(), 'from deeplink', 'should match deeplink params');
  t.end();
});
