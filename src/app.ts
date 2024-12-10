import express, { Application, Request, Response } from "express";
import bodyParser from "body-parser";
import hubspotRoutes from "./routes/hubspotRoutes";
import { handleMessageWebhook } from "../src/integrations/hubspot/hubspotController";
import { startTokenRefreshTimers } from "./services";

const app: Application = express();

app.use(bodyParser.json());
app.use("/hubspot", hubspotRoutes);
app.post("/notification", handleMessageWebhook);

app.get("/health", (req, res) => {
  res.send(`Server is up and running`);
});

export default app;
