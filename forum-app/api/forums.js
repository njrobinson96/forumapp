// api/forums.js
import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        if (req.method === 'GET') {
            // Get all forums
            const forumIds = await kv.smembers('forums');
            const forums = [];
            
            for (const forumId of forumIds) {
                const forum = await kv.get(`forum:${forumId}`);
                if (forum) {
                    // Get participant count
                    const participants = await kv.scard(`forum:${forumId}:participants`) || 0;
                    forums.push({ ...forum, participants });
                }
            }
            
            // Sort by participant count
            forums.sort((a, b) => b.participants - a.participants);
            
            return res.status(200).json(forums);
        }
        
        if (req.method === 'POST') {
            // Handle both create forum and join/leave operations
            const pathSegments = req.url.split('/');
            
            if (pathSegments.length > 3) {
                // Join or leave forum
                const forumId = pathSegments[2];
                const action = pathSegments[3];
                
                if (action === 'join') {
                    return handleJoinForum(req, res, forumId);
                } else if (action === 'leave') {
                    return handleLeaveForum(req, res, forumId);
                }
            } else {
                // Create new forum
                return handleCreateForum(req, res);
            }
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Forums error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleCreateForum(req, res) {
    const { title, topic, hostId } = req.body;
    
    if (!title || !hostId) {
        return res.status(400).json({ error: 'Title and host ID are required' });
    }
    
    const user = await kv.get(`user:${hostId}`);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const forumId = nanoid();
    const forum = {
        id: forumId,
        title,
        topic: topic || 'general',
        host: user.displayName,
        hostId,
        participants: 0,
        createdAt: new Date().toISOString()
    };
    
    await kv.set(`forum:${forumId}`, forum);
    await kv.sadd('forums', forumId);
    
    // Broadcast forum creation
    await broadcastEvent({
        type: 'forum_created',
        forum
    });
    
    return res.status(200).json(forum);
}

async function handleJoinForum(req, res, forumId) {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    const [forum, user] = await Promise.all([
        kv.get(`forum:${forumId}`),
        kv.get(`user:${userId}`)
    ]);
    
    if (!forum || !user) {
        return res.status(404).json({ error: 'Forum or user not found' });
    }
    
    // Add user to forum participants
    await kv.sadd(`forum:${forumId}:participants`, userId);
    await kv.sadd(`user:${userId}:forums`, forumId);
    
    const participants = await kv.scard(`forum:${forumId}:participants`);
    
    // Broadcast user joined
    await broadcastEvent({
        type: 'user_joined',
        roomId: forumId,
        userId,
        userName: user.displayName,
        participants
    });
    
    return res.status(200).json({ ...forum, participants });
}

async function handleLeaveForum(req, res, forumId) {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    const user = await kv.get(`user:${userId}`);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove user from forum participants
    await kv.srem(`forum:${forumId}:participants`, userId);
    await kv.srem(`user:${userId}:forums`, forumId);
    
    const participants = await kv.scard(`forum:${forumId}:participants`);
    
    // Broadcast user left
    await broadcastEvent({
        type: 'user_left',
        roomId: forumId,
        userId,
        userName: user.displayName,
        participants
    });
    
    return res.status(200).json({ success: true });
}

async function broadcastEvent(event) {
    const connections = await kv.smembers('sse:connections');
    
    for (const connId of connections) {
        const eventData = await kv.get(`sse:event:${connId}`);
        if (eventData) {
            await kv.lpush(`sse:queue:${connId}`, JSON.stringify(event));
        }
    }
}