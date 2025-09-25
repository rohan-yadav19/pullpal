import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import { PrismaClient } from './generated/prisma';


import authRoutes from './routes/auth';
import webhookRoutes from './routes/webhooks';


dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cors());


app.use('/auth', authRoutes);
app.use('/webhooks', webhookRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
