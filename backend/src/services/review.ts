import { fetchPullRequestDiff, postReviewComments } from './github';
import { PrismaClient, Repo } from '../generated/prisma';



import { GoogleGenAI } from '@google/genai';

const prisma = new PrismaClient();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Handles PR event: fetch diff, get AI feedback, post comments, store review
export async function handlePullRequestEvent(body: any, repo: Repo) {
    const prNumber = body.pull_request.number;
    const owner = repo.owner;
    const name = repo.name;

    // Get user token
    const user = await prisma.user.findUnique({ where: { id: repo.userId } });
    if (!user) throw new Error('User not found');

    // Fetch PR diff
    const diff = await fetchPullRequestDiff(owner, name, prNumber, user.githubToken);

    // Send to OpenAI for review
    const aiFeedback = await getAIReview(diff, { prNumber, owner, name });

    // Post comments to GitHub
    await postReviewComments(owner, name, prNumber, aiFeedback, user.githubToken);

    // Store review in DB
    await prisma.review.create({
        data: {
            prNumber,
            repoId: repo.id,
            aiFeedback,
        },
    });
}

// Calls Gemini API to get structured review feedback
export async function getAIReview(diff: string, meta: { prNumber: number; owner: string; name: string }) {
    const prompt = `
            You are a code review assistant. Analyze the following GitHub PR diff and provide feedback as a JSON array with objects: { "file": string, "line": number, "comment": string }.

                Diff:
${diff}
`;


    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: prompt,
    });
    // Gemini API call

    const text = response.text || '[]';

    try {
        return JSON.parse(text);
    } catch {
        return [];
    }
}
