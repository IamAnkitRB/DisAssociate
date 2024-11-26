import { Request, Response } from "express";
import { Client } from "@hubspot/api-client";
import { HUBSPOT_ACCESS_TOKEN } from "../../config/default";
import axios from "axios";
import { hubspotConfig } from "../../config/hubspot";

const hubspot = new Client({ accessToken: HUBSPOT_ACCESS_TOKEN });

let accessToken: string | null = null;

/**
 * Initiates OAuth flow by redirecting the user to HubSpot's authorization URL.
 */
export const initiateOAuth = (req: Request, res: Response): void => {
  const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${hubspotConfig.clientId}&redirect_uri=${hubspotConfig.redirectUri}&scope=crm.objects.contacts.read`;
  console.log("auth url::", authUrl);
  res.redirect(authUrl);
};

/**
 * Handles the OAuth callback and exchanges the authorization code for an access token.
 */
export const handleOAuthCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { code } = req.query;

  if (!code) {
    res.status(400).send("Missing authorization code");
    return;
  }

  try {
    const tokenResponse = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: hubspotConfig.clientId || "",
        client_secret: hubspotConfig.clientSecret || "",
        redirect_uri: hubspotConfig.redirectUri || "",
        code: code as string,
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    accessToken = tokenResponse.data.access_token;

    console.log("Access Token:", accessToken);

    res
      .status(200)
      .send("Authorization successful. You can now make API requests.");
  } catch (error: any) {
    console.error(
      "Error exchanging token:",
      error.response?.data || error.message
    );
    res.status(500).send("Error during OAuth process");
  }
};

/**
 * Tests making an API request to HubSpot using the access token.
 */
export const testApiRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!accessToken) {
    res.status(401).send("Not authorized. Please authenticate using /oauth.");
    return;
  }

  try {
    const response = await axios.get(
      "https://api.hubapi.com/crm/v3/objects/contacts",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error(
      "Error making API request:",
      error.response?.data || error.message
    );
    res.status(500).send("Error making API request");
  }
};

/**
 * Handles workflow actions triggered by HubSpot workflows.
 */
export const handleWorkflowAction = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const workflowData = req.body;

    const {
      primaryObjectType,
      primaryObjectId,
      associatedObjectType,
      associatedObjectId,
      associationType,
    } = workflowData;

    if (
      !primaryObjectType ||
      !primaryObjectId ||
      !associatedObjectType ||
      !associatedObjectId ||
      !associationType
    ) {
      return res.status(400).json({
        error:
          "Missing required data: primaryObjectType, primaryObjectId, associatedObjectType, associatedObjectId, or associationType",
      });
    }

    const response =
      await hubspot.crm.associations.v4.basicApi.archiveWithHttpInfo(
        primaryObjectType,
        primaryObjectId,
        associatedObjectType,
        associatedObjectId
      );

    if (response.httpStatusCode === 204) {
      console.log("Disassociation successful");
    }

    return res
      .status(200)
      .json({ success: true, message: "Objects disassociated successfully" });
  } catch (error: any) {
    if (error.response?.body) {
      console.error(
        "HubSpot API error:",
        JSON.stringify(error.response.body, null, 2)
      );
    } else {
      console.error("Unexpected error:", error);
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
