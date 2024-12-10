import { Router, Request, Response } from "express";
import {
  initiateOAuth,
  handleOAuthCallback,
  testApiRequest,
  handleWorkflowAction,
  handleWebhookData,
  handleDisassociateWebhookData,
  handleMessageWebhook,
  fetchProps,
} from "../integrations/hubspot/hubspotController";

const router = Router();

router.post("/workflow-action", handleWorkflowAction);
router.get("/oauth", initiateOAuth);
router.get("/oauth/callback", handleOAuthCallback);
router.get("/test-api", testApiRequest);
router.post("/hubspot-webhook", handleDisassociateWebhookData);
router.post("/notification", handleMessageWebhook);
router.post("/disassociate", handleDisassociateWebhookData);
router.post("/fetchProps", fetchProps);

export default router;
