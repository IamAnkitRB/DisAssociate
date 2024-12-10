import { refreshAccessToken } from "../integrations/hubspot/hubspotController";
const REFRESH_INTERVAL = 25 * 60 * 1000; // 25 minutes in milliseconds

export const startTokenRefreshTimers = (userId: string) => {
  console.log(`Started timer for user ${userId}`);

  // Refresh the token immediately
  refreshAccessToken(userId);

  // Set an interval to refresh every 25 minutes
  setInterval(() => refreshAccessToken(userId), REFRESH_INTERVAL);
};
