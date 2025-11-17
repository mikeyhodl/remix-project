import React from 'react';
import { Alert } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';

const CreateInstance: React.FC = () => {
  
  return (
    <div className="text-center">
      <Alert className="mt-4 text-start" variant="info" data-id="quickDappTooltips">
        <FormattedMessage id="quickDapp.text1" />
        <br />
        <FormattedMessage id="quickDapp.text2" />
      </Alert>
      <img src='./assets/sparkling.png' style={{ width: '40%' }} />
      <div className="mt-4 mb-3">
        <FormattedMessage id="quickDapp.text7" />
      </div>
    </div>
  );
};

export default CreateInstance;
