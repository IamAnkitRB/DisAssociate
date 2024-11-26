export const hubspotConfig = {
    clientId: process.env.HUBSPOT_CLIENT_ID,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
    redirectUri: `${process.env.BASE_URL}/hubspot/oauth/callback`,
  };
  