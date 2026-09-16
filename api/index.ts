import serverless from 'serverless-http';
import app from '../backend/src/index';

export const handler = serverless(app);
export default handler;