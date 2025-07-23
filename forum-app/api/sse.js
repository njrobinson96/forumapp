// api/sse.js
import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';

export default async function handler(req, res) {
    const { userId } = req.query;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const connectionId = nanoid();
    
    // Register connection
    await kv.sadd('sse:connections', connectionId);
    await kv.set(`sse:connection:${connectionId}`, { userId, connectedAt: Date.now() });
    
    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', connectionId })}\n\n`);
    
    // Set up heartbeat
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);
    
    // Check for messages periodically
    const messageCheck = setInterval(async () => {
        try {
            const messages = await kv.lrange(`sse:queue:${connectionId}`, 0, -1);
            
            if (messages && messages.length > 0) {
                for (const message of messages) {
                    res.write(`data: ${message}\n\n`);
                }
                
                // Clear processed messages
                await kv.del(`sse:queue:${connectionId}`);
            }
        } catch (error) {
            console.error('SSE message check error:', error);
        }
    }, 100);
    
    // Clean up on connection close
    req.on('close', async () => {
        clearInterval(heartbeat);
        clearInterval(messageCheck);
        
        await kv.srem('sse:connections', connectionId);
        await kv.del(`sse:connection:${connectionId}`);
        await kv.del(`sse:queue:${connectionId}`);
    });
    
    // Keep connection alive
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);
}