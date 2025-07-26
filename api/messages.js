// api/messages.js - Upgraded v2.0
const { Redis } = require('@upstash/redis');
const redis = Redis.fromEnv();
const { nanoid } = require('nanoid');

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // Handle typing indicator endpoints
        if (req.url.includes('/typing')) {
            return await handleTypingIndicator(req, res);
        }
        
        if (req.method === 'GET') {
            return await handleGetMessages(req, res);
        }
        
        if (req.method === 'POST') {
            return await handleSendMessage(req, res);
        }
        
        if (req.method === 'PUT') {
            return await handleEditMessage(req, res);
        }
        
        if (req.method === 'DELETE') {
            return await handleDeleteMessage(req, res);
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Messages error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

async function handleGetMessages(req, res) {
    const { forumId, limit = 50, offset = 0 } = req.query;
    
    if (!forumId) {
        return res.status(400).json({ error: 'Forum ID is required' });
    }
    
    try {
        // Verify forum exists
        const forum = await redis.get(`forum:${forumId}`);
        if (!forum) {
            return res.status(404).json({ error: 'Forum not found' });
        }
        
        // Get message IDs with pagination
        const messageIds = await redis.lrange(
            `forum:${forumId}:messages`, 
            parseInt(offset), 
            parseInt(offset) + parseInt(limit) - 1
        );
        
        const messages = [];
        
        // Fetch messages in parallel for better performance
        const messagePromises = messageIds.map(msgId => redis.get(`message:${msgId}`));
        const messageResults = await Promise.all(messagePromises);
        
        // Filter out null results and sort by timestamp
        messageResults.forEach(message => {
            if (message) {
                messages.push(message);
            }
        });
        
        // Sort messages by timestamp (oldest first for chat display)
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        return res.status(200).json({
            messages,
            hasMore: messageIds.length === parseInt(limit),
            total: await redis.llen(`forum:${forumId}:messages`) || 0
        });
    } catch (error) {
        console.error('Get messages error:', error);
        return res.status(500).json({ error: 'Failed to fetch messages' });
    }
}

async function handleSendMessage(req, res) {
    const { forumId, userId, text } = req.body;
    
    if (!forumId || !userId || !text) {
        return res.status(400).json({ error: 'Forum ID, user ID, and text are required' });
    }
    
    // Validate message length
    const cleanText = text.trim();
    if (cleanText.length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
    }
    
    if (cleanText.length > 1000) {
        return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }
    
    try {
        // Verify user and forum exist
        const [user, forum] = await Promise.all([
            redis.get(`user:${userId}`),
            redis.get(`forum:${forumId}`)
        ]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!forum) {
            return res.status(404).json({ error: 'Forum not found' });
        }
        
        // Check if user is a participant in the forum
        const isParticipant = await redis.sismember(`forum:${forumId}:participants`, userId);
        if (!isParticipant) {
            return res.status(403).json({ error: 'You must join the forum to send messages' });
        }
        
        // Rate limiting: Check if user sent a message in the last 2 seconds
        const lastMessageKey = `user:${userId}:lastMessage`;
        const lastMessageTime = await redis.get(lastMessageKey);
        const now = Date.now();
        
        if (lastMessageTime && (now - parseInt(lastMessageTime)) < 2000) {
            return res.status(429).json({ error: 'Please wait before sending another message' });
        }
        
        const messageId = nanoid();
        const message = {
            id: messageId,
            forumId,
            userId,
            userName: user.displayName,
            text: cleanText,
            timestamp: new Date().toISOString(),
            edited: false
        };
        
        // Store message and update forum message list
        await Promise.all([
            redis.set(`message:${messageId}`, message),
            redis.lpush(`forum:${forumId}:messages`, messageId),
            redis.set(lastMessageKey, now.toString(), { ex: 2 }) // 2 second expiry
        ]);
        
        // Trim messages to last 200 (keep more for better UX)
        await redis.ltrim(`forum:${forumId}:messages`, 0, 199);
        
        // Update user statistics
        const updatedUser = { ...user };
        updatedUser.messageCount = (updatedUser.messageCount || 0) + 1;
        updatedUser.lastActive = new Date().toISOString();
        await redis.set(`user:${userId}`, updatedUser);
        
        // Update forum's last activity
        forum.lastActivity = new Date().toISOString();
        await redis.set(`forum:${forumId}`, forum);
        
        // Clear typing indicator for this user
        await redis.del(`typing:${forumId}:${userId}`);
        
        // Broadcast message to all connected clients
        await broadcastEvent({
            type: 'message',
            roomId: forumId,
            message
        });
        
        // Also broadcast typing stopped
        await broadcastEvent({
            type: 'typing',
            roomId: forumId,
            userId,
            userName: user.displayName,
            isTyping: false
        });
        
        return res.status(201).json(message);
    } catch (error) {
        console.error('Send message error:', error);
        return res.status(500).json({ error: 'Failed to send message' });
    }
}

async function handleTypingIndicator(req, res) {
    const { forumId, userId } = req.body;
    
    if (!forumId || !userId) {
        return res.status(400).json({ error: 'Forum ID and user ID are required' });
    }
    
    try {
        const user = await redis.get(`user:${userId}`);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if user is a participant
        const isParticipant = await redis.sismember(`forum:${forumId}:participants`, userId);
        if (!isParticipant) {
            return res.status(403).json({ error: 'You must join the forum first' });
        }
        
        if (req.method === 'POST') {
            // User started typing - set with 5 second expiry
            await redis.setex(`typing:${forumId}:${userId}`, 5, user.displayName);
            
            await broadcastEvent({
                type: 'typing',
                roomId: forumId,
                userId,
                userName: user.displayName,
                isTyping: true
            });
        } else if (req.method === 'DELETE') {
            // User stopped typing
            await redis.del(`typing:${forumId}:${userId}`);
            
            await broadcastEvent({
                type: 'typing',
                roomId: forumId,
                userId,
                userName: user.displayName,
                isTyping: false
            });
        }
        
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Typing indicator error:', error);
        return res.status(500).json({ error: 'Failed to handle typing indicator' });
    }
}

async function handleEditMessage(req, res) {
    const { messageId, userId, text } = req.body;
    
    if (!messageId || !userId || !text) {
        return res.status(400).json({ error: 'Message ID, user ID, and text are required' });
    }
    
    // Validate message length
    const cleanText = text.trim();
    if (cleanText.length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
    }
    
    if (cleanText.length > 1000) {
        return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }
    
    try {
        // Get the message
        const message = await redis.get(`message:${messageId}`);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        // Check if user owns the message
        if (message.userId !== userId) {
            return res.status(403).json({ error: 'You can only edit your own messages' });
        }
        
        // Update message
        const updatedMessage = {
            ...message,
            text: cleanText,
            edited: true,
            editedAt: new Date().toISOString()
        };
        
        await redis.set(`message:${messageId}`, updatedMessage);
        
        // Broadcast message update
        await broadcastEvent({
            type: 'message_edited',
            roomId: message.forumId,
            message: updatedMessage
        });
        
        return res.status(200).json(updatedMessage);
    } catch (error) {
        console.error('Edit message error:', error);
        return res.status(500).json({ error: 'Failed to edit message' });
    }
}

async function handleDeleteMessage(req, res) {
    const { messageId, userId } = req.body;
    
    if (!messageId || !userId) {
        return res.status(400).json({ error: 'Message ID and user ID are required' });
    }
    
    try {
        // Get the message
        const message = await redis.get(`message:${messageId}`);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        // Check if user owns the message
        if (message.userId !== userId) {
            return res.status(403).json({ error: 'You can only delete your own messages' });
        }
        
        // Delete message
        await redis.del(`message:${messageId}`);
        await redis.lrem(`forum:${message.forumId}:messages`, 0, messageId);
        
        // Broadcast message deletion
        await broadcastEvent({
            type: 'message_deleted',
            roomId: message.forumId,
            messageId
        });
        
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Delete message error:', error);
        return res.status(500).json({ error: 'Failed to delete message' });
    }
}

async function broadcastEvent(event) {
    try {
        // Get all active SSE connections
        const connections = await redis.smembers('sse:connections') || [];
        
        if (connections.length === 0) {
            return; // No active connections
        }
        
        // Queue event for each connection with error handling
        const promises = connections.map(async (connId) => {
            try {
                await redis.lpush(`sse:queue:${connId}`, JSON.stringify(event));
                // Set expiry on queue items (30 minutes)
                await redis.expire(`sse:queue:${connId}`, 1800);
            } catch (error) {
                console.error(`Failed to queue event for connection ${connId}:`, error);
                // Remove invalid connection
                await redis.srem('sse:connections', connId);
            }
        });
        
        await Promise.allSettled(promises);
    } catch (error) {
        console.error('Broadcast error:', error);
    }
}
