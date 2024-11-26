import express, { Application } from 'express';
import bodyParser from 'body-parser';
import hubspotRoutes from './routes/hubspotRoutes';

const app: Application = express();

app.use(bodyParser.json());
app.use('/hubspot', hubspotRoutes);

export default app;
