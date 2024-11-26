import { Router, Request, Response } from "express";
import {
  initiateOAuth,
  handleOAuthCallback,
  testApiRequest,
  handleWorkflowAction,
} from "../integrations/hubspot/hubspotController";

const router = Router();

router.post("/workflow-action", handleWorkflowAction);
router.get("/oauth", initiateOAuth);
router.get("/oauth/callback", handleOAuthCallback);
router.get("/test-api", testApiRequest);
router.post("/workflow-action", handleWorkflowAction);

export default router;
