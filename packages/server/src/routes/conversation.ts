import { Router, Request, Response } from 'express';
import { startConversation, processMessage } from '../services/conversation';

export const conversationRouter = Router();

// POST /api/v1/conversation/start
conversationRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const { merchantId, sessionId, metadata } = req.body;

    if (!merchantId || !sessionId) {
      res.status(400).json({ error: 'merchantId and sessionId are required' });
      return;
    }

    const result = await startConversation(merchantId, sessionId, metadata);
    res.json(result);
  } catch (error) {
    console.error('[Route] /conversation/start error:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// POST /api/v1/conversation/message
conversationRouter.post('/message', async (req: Request, res: Response) => {
  try {
    const { conversationId, message } = req.body;

    if (!conversationId || !message) {
      res.status(400).json({ error: 'conversationId and message are required' });
      return;
    }

    const result = await processMessage(conversationId, message);
    res.json(result);
  } catch (error) {
    console.error('[Route] /conversation/message error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});
