import express, { Application, Request, Response } from "express";
import bodyParser from "body-parser";
import hubspotRoutes from "./routes/hubspotRoutes";

const app: Application = express();

app.use(bodyParser.json());
app.use("/hubspot", hubspotRoutes);

app.get("/health", (req, res) => {
  res.send(`Server is up and running`);
});

export default app;
