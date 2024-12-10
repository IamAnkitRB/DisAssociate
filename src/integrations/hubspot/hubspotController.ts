import { Request, Response } from "express";
import { Client } from "@hubspot/api-client";
import { HUBSPOT_ACCESS_TOKEN } from "../../config/default";
import axios from "axios";
import { hubspotConfig } from "../../config/hubspot";
import { PrismaClient } from "@prisma/client";
import { startTokenRefreshTimers } from "../../services";
const prisma = new PrismaClient();
const hubspot = new Client({ accessToken: HUBSPOT_ACCESS_TOKEN });

// In-memory storage for user tokens (for demonstration purposes)
const userTokens: {
  [userId: string]: { accessToken: string; refreshToken: string };
} = {};

// Method to get the access token for a specific user
const getAccessToken = (userId: string): string | null => {
  return userTokens[userId]?.accessToken || null;
};

// Method to set the tokens for a specific user
const setTokens = (
  userId: string,
  accessToken: string,
  refreshToken: string
): void => {
  userTokens[userId] = { accessToken, refreshToken };
};

let accessToken: string | null = null;
let refreshToken: string | null = null;

/**
 * Initiates OAuth flow by redirecting the user to HubSpot's authorization URL.
 */
export const initiateOAuth = (req: Request, res: Response): void => {
  const scopes = [
    "crm.objects.companies.read",
    "crm.objects.companies.write",
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.schemas.companies.read",
    "crm.schemas.companies.write",
    "crm.schemas.contacts.read",
    "crm.schemas.contacts.write",
    "oauth",
  ];
  const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${
    hubspotConfig.clientId
  }&redirect_uri=${hubspotConfig.redirectUri}&scope=${encodeURIComponent(
    scopes.join(" ")
  )}`;
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
    res.status(400).send("Missing authorization code or user ID");
    return;
  }

  try {
    // Exchange the authorization code for tokens
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

    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token;

    // await prisma.userToken.create({
    //   refreshToken,
    // });

    // console.log(`Access token for user ${userId} received and stored.`);

    // Start the refresh interval for this user
    // startTokenRefreshTimers(userId as string);
    console.log("access token::", accessToken);
    console.log("refresh token::", refreshToken);

    res.status(200).send("Authorization successful. Tokens stored.");
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
 * Refreshes the access token using the refresh token.
 */
export const refreshAccessToken = async (userId: string): Promise<void> => {
  try {
    // Get the user's tokens from the database
    const userToken = await prisma.userToken.findUnique({
      where: { userId },
    });

    if (!userToken) {
      console.error(`No tokens found for user: ${userId}`);
      return;
    }

    const refreshToken = userToken.refreshToken;

    // Make the request to refresh the access token
    const response = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: hubspotConfig.clientId || "",
        client_secret: hubspotConfig.clientSecret || "",
        refresh_token: refreshToken,
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const data = response.data;
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;

    // Update the tokens in the database
    await prisma.userToken.update({
      where: { userId },
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });

    console.log(`Access token refreshed for user ${userId}:`, newAccessToken);
  } catch (error: any) {
    console.error(
      `Error refreshing access token for user ${userId}:`,
      error.response?.data || error.message
    );
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

export const handleWebhookData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = req.body;
    console.log("Data received from webhook", data);

    res.status(200).json({
      success: true,
      message: "Data received successfully",
    });
  } catch (error: any) {
    console.error(
      "Error refreshing access token:",
      error.response?.data || error.message
    );
  }
};
export const handleDisassociateWebhookData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const webhookData = req.body; // The request body is an array

    console.log("webhook data::", webhookData);

    // Loop through each object in the array
    for (const data of webhookData) {
      const {
        fromObjectId,
        toObjectId,
        fromObjectTypeId,
        toObjectTypeId,
        associationType,
        associationTypeId,
      } = data;

      console.log("Data received from webhook", data);

      // Validate that all necessary fields are present
      if (
        !fromObjectId ||
        !toObjectId ||
        !fromObjectTypeId ||
        !toObjectTypeId ||
        !associationType
      ) {
        console.error("Missing required fields:", data);
        res.status(400).json({
          success: false,
          message: "Missing required fields in the webhook data",
        });
        return;
      }

      // Construct the request URL for each object
      const url = `https://api.hubapi.com/crm/v4/objects/${fromObjectTypeId}/${fromObjectId}/associations/${toObjectTypeId}/${toObjectId}/${associationTypeId}`;

      // Make the API request to disassociate the objects
      try {
        const response =
          await hubspot.crm.associations.v4.basicApi.archiveWithHttpInfo(
            fromObjectTypeId,
            fromObjectId,
            toObjectTypeId,
            toObjectId
          );

        // const response = await axios.delete(url, {
        //   headers: {
        //     Authorization: `Bearer ${accessToken}`,
        //   },
        // });

        console.log("Disassociation successful:", response);
      } catch (error: any) {
        console.error("Error disassociating:", error?.stack || error);
        res.status(500).json({
          success: false,
          message: "Error handling webhook data",
        });
        return;
      }
    }

    // If all associations are handled, send a success response
    res.status(200).json({
      success: true,
      message: "Objects disassociated successfully",
    });
  } catch (error: any) {
    console.error("Error handling webhook data:", error?.stack || error);
    res.status(500).json({
      success: false,
      message: "Error handling webhook data",
    });
  }
};

export const handleMessageWebhook = async (req: Request, res: Response) => {
  try {
    const data = req.body;

    console.log("Data from webhook::", JSON.stringify(data));
    res.status(200).json({
      message: "Data received",
    });
  } catch (error: any) {
    console.log("Error while capturing messages::", error.stack);
    res.status(500).json({
      message: "Error",
    });
  }
};

export const createCustomAction = async (req: Request, res: Response) => {
  const ExtensionActionDefinitionInput = {
    actionUrl: `${process.env.PUBLIC_URL}/create_custom_action`,
    inputFields: [
      {
        typeDefinition: {
          name: "widgetName",
          type: "string",
          fieldType: "text",
        },
        supportedValueTypes: ["STATIC_VALUE"],
        isRequired: true,
      },
      {
        typeDefinition: {
          name: "widgetColor",
          type: "enumeration",
          fieldType: "select",
          options: [
            { value: "red", label: "Red" },
            { value: "blue", label: "Blue" },
            { value: "green", label: "Green" },
          ],
        },
        supportedValueTypes: ["STATIC_VALUE"],
      },
      {
        typeDefinition: {
          name: "widgetOwner",
          type: "enumeration",
          referencedObjectType: "OWNER",
        },
        supportedValueTypes: ["STATIC_VALUE"],
      },
      {
        typeDefinition: {
          name: "widgetQuantity",
          type: "number",
        },
        supportedValueTypes: ["OBJECT_PROPERTY"],
      },
    ],
    labels: {
      en: {
        actionName: "Create Widget - Example 1",
        actionDescription:
          "This action will create a new widget in our system. So cool!",
        actionCardContent: "Create widget {{widgetName}}",
        inputFieldLabels: {
          widgetName: "Widget Name",
          widgetColor: "Widget Color",
          widgetOwner: "Widget Owner",
          widgetQuantity: "Widget Quantity",
        },
        inputFieldDescriptions: {
          widgetName:
            "Enter the full widget name. I support <a href='https://hubspot.com'>links</a> too.",
          widgetColor:
            "This is the color that will be used to paint the widget.",
        },
      },
    },
    objectTypes: ["CONTACT", "DEAL"],
  };

  let output_response = { error: "Something went wrong" };

  // try {
  //   const apiResponse = await hubspot.automation.actions.definitionsApi.create(
  //     process.env.APP_ID,
  //     ExtensionActionDefinitionInput
  //   );
  //   output_response = JSON.stringify(apiResponse, null, 2);
  // } catch (e) {
  //   console.error("Error:", e);
  //   output_response = JSON.stringify(e.response, null, 2);
  // }

  res.json(output_response);
};

export const fetchProps = async (req: Request, res: Response): Promise<any> => {
  try {
    const { objectTypeId } = req.body;

    // HubSpot API endpoint to fetch object properties
    const HUBSPOT_API_BASE_URL = "https://api.hubapi.com/crm/v3/properties";
    const OAUTH_ACCESS_TOKEN = "YOUR_HUBSPOT_API_KEY";

    if (!objectTypeId) {
      return res.status(400).json({
        success: false,
        message: "Missing objectTypeId in request body",
      });
    }

    // Construct API URL
    const apiUrl = `${HUBSPOT_API_BASE_URL}/${objectTypeId}`;

    // Make the API request
    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${OAUTH_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    // Send back the properties
    return res.status(200).json({
      success: true,
      message: "Data fetched successfully",
      data: response.data.results,
    });
  } catch (error: any) {
    console.error("Error fetching properties:", error?.stack || error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
