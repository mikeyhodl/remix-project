import React from 'react';
import { Alert } from 'react-bootstrap'; 
import { FormattedMessage } from 'react-intl';

const CreateInstance: React.FC = () => {
  
  return (
    <div className="text-center">

      <Alert 
        className="mt-4 d-flex align-items-center justify-content-center" 
        variant="info" 
        data-id="quickDappTooltips"
      >
        
        <div className="flex-shrink-0 me-3">
          <img 
            src='./assets/sparkling.png' 
            style={{ width: '300px' }} 
            alt="Sparkling star icon" 
          />
        </div>
        <div className="text-start"> 
          <FormattedMessage id="quickDapp.text1" />
          <br />
          <FormattedMessage id="quickDapp.text2" />
        </div>
      </Alert>
      <div className="mt-4 mb-3">
        <FormattedMessage id="quickDapp.text7" />
      </div>
    </div>
  );
};

export default CreateInstance;