import { Request, Response } from 'express';
import { Client } from '@hubspot/api-client';

const hubspot = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

export const handleWorkflowAction = async (req: Request, res: Response) => {
  try {
    const workflowData = req.body;
    console.log('Received workflow data:', workflowData);

    // Disassociation Logic Here
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling workflow action:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
