import { Router } from 'express';
import { handleWorkflowAction } from '../integrations/hubspot/hubspotController';

const router = Router();

router.post('/workflow-action', handleWorkflowAction);

export default router;
