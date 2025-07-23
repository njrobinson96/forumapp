// api/messages.js
import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // Handle typing indicator
        if (req.url.includes('/typing')) {
            return handleTypingIndicator(req, res);
        }
        
        if (req.method === 'GET') {
            // Get messages for a forum
            const { forumId } = req.query;
            
            if (!forumId) {
                return res.status(400).json({ error: 'Forum ID is required' });
            }
            
            const messageIds = await kv.lrange(`forum:${forumId}:messages`, 0, -1);
            const messages = [];
            
            for (const msgId of messageIds) {
                const message = await kv.get(`message:${msgId}`);
                if (message) {
                    messages.push(message);
                }
            }
            
            return res.status(200).json(messages);
        }
        
        if (req.method === 'POST') {
            // Send a message
            const { forumId, userId, text } = req.body;
            
            if (!forumId || !userId || !text) {
                return res.status(400).json({ error: 'Forum ID, user ID, and text are required' });
            }
            
            const user = await kv.get(`user:${userId}`);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const messageId = nanoid();
            const message = {
                id: messageId,
                forumId,
                userId,
                userName: user.displayName,
                text: text.substring(0, 500), // Limit message length
                timestamp: new Date().toISOString()
            };
            
            // Store message
            await kv.set(`message:${messageId}`, message);
            await kv.lpush(`forum:${forumId}:messages`, messageId);
            
            // Trim messages to last 100
            await kv.ltrim(`forum:${forumId}:messages`, 0, 99);
            
            // Update user message count
            await kv.hincrby(`user:${userId}`, 'messageCount', 1);
            
            // Broadcast message
            await broadcastEvent({
                type: 'message',
                roomId: forumId,
                message
            });
            
            return res.status(200).json(message);
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Messages error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleTypingIndicator(req, res) {
    const { forumId, userId } = req.body;
    
    if (!forumId || !userId) {
        return res.status(400).json({ error: 'Forum ID and user ID are required' });
    }
    
    const user = await kv.get(`user:${userId}`);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    if (req.method === 'POST') {
        // User started typing
        await kv.setex(`typing:${forumId}:${userId}`, 3, user.displayName);
        
        await broadcastEvent({
            type: 'typing',
            roomId: forumId,
            userId,
            userName: user.displayName,
            isTyping: true
        });
    } else if (req.method === 'DELETE') {
        // User stopped typing
        await kv.del(`typing:${forumId}:${userId}`);
        
        await broadcastEvent({
            type: 'typing',
            roomId: forumId,
            userId,
            userName: user.displayName,
            isTyping: false
        });
    }
    
    return res.status(200).json({ success: true });
}

async function broadcastEvent(event) {
    const connections = await kv.smembers('sse:connections');
    
    for (const connId of connections) {
        await kv.lpush(`sse:queue:${connId}`, JSON.stringify(event));
    }
}