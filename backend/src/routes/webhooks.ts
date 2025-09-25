import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '../generated/prisma';
import { handlePullRequestEvent } from '../services/review';


const router = express.Router();
const prisma = new PrismaClient();

// Helper to verify GitHub webhook signature
function verifySignature(secret: string, payload: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const digest = `sha256=${hmac.digest('hex')}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

router.post('/github', express.raw({ type: '*/*' }), async (req, res) => {
    const event = req.headers['x-github-event'];
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const payload = req.body;

    try {
        const body = JSON.parse(payload.toString());
        const repoId = String(body.repository.id);

        // Get repo and secret
        const repo = await prisma.repo.findUnique({ where: { githubRepoId: repoId } });
        if (!repo) return res.status(404).json({ error: 'Repo not found' });

        if (!verifySignature(repo.webhookSecret, payload, signature)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Only handle PR opened/synchronize
        if (event === 'pull_request' && ['opened', 'synchronize'].includes(body.action)) {
            await handlePullRequestEvent(body, repo);
        }

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Webhook error' });
    }
});

export default router;
