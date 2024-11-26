import { Request, Response } from 'express';
import { Client } from '@hubspot/api-client';
import {HUBSPOT_ACCESS_TOKEN} from '../../config/default'

const hubspot = new Client({ accessToken: HUBSPOT_ACCESS_TOKEN });



export const handleWorkflowAction = async (req: Request, res: Response): Promise<any> => {
  try {
    const workflowData = req.body;
    
    const { primaryObjectType, primaryObjectId, associatedObjectType, associatedObjectId, associationType } = workflowData;

    if (!primaryObjectType || !primaryObjectId || !associatedObjectType || !associatedObjectId || !associationType) {
      return res.status(400).json({
        error: 'Missing required data: primaryObjectType, primaryObjectId, associatedObjectType, associatedObjectId, or associationType',
      });
    }

    const response =await hubspot.crm.associations.v4.basicApi.archiveWithHttpInfo(
      primaryObjectType, 
      primaryObjectId,   
      associatedObjectType, 
      associatedObjectId  
    );

    if(response.httpStatusCode === 204){
      console.log('Disassociation successful');
    }


    return res.status(200).json({ success: true, message: 'Objects disassociated successfully' });
  } catch (error: any) {
    if (error.response?.body) {
      console.error('HubSpot API error:', JSON.stringify(error.response.body, null, 2));
    } else {
      console.error('Unexpected error:', error);
    }
    return  res.status(500).json({ error: 'Internal Server Error' });
  }
};

