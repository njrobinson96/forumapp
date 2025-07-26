// api/forums.js - Upgraded v2.0
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
        if (req.method === 'GET') {
            return await handleGetForums(req, res);
        }
        
        if (req.method === 'POST') {
            // Parse URL to determine action
            const url = new URL(req.url, `http://${req.headers.host}`);
            const pathSegments = url.pathname.split('/').filter(Boolean);
            
            // Check if it's a join/leave action: /api/forums/{forumId}/{action}
            if (pathSegments.length >= 4 && pathSegments[2]) {
                const forumId = pathSegments[2];
                const action = pathSegments[3];
                
                if (action === 'join') {
                    return await handleJoinForum(req, res, forumId);
                } else if (action === 'leave') {
                    return await handleLeaveForum(req, res, forumId);
                }
            } else {
                // Create new forum
                return await handleCreateForum(req, res);
            }
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Forums error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

async function handleGetForums(req, res) {
    try {
        const { search, topic, trending } = req.query;
        
        // Get all forum IDs
        const forumIds = await redis.smembers('forums') || [];
        const forums = [];
        
        // Fetch each forum with participant count
        for (const forumId of forumIds) {
            const forum = await redis.get(`forum:${forumId}`);
            if (forum) {
                // Get current participant count
                const participants = await redis.scard(`forum:${forumId}:participants`) || 0;
                forums.push({ 
                    ...forum, 
                    participants,
                    isActive: participants > 0
                });
            }
        }
        
        // Apply filters
        let filteredForums = forums;
        
        // Search filter
        if (search) {
            const searchTerm = search.toLowerCase();
            filteredForums = filteredForums.filter(forum => 
                forum.title.toLowerCase().includes(searchTerm) ||
                forum.topic.toLowerCase().includes(searchTerm) ||
                forum.host.toLowerCase().includes(searchTerm)
            );
        }
        
        // Topic filter
        if (topic && topic !== 'all') {
            filteredForums = filteredForums.filter(forum => forum.topic === topic);
        }
        
        // Trending filter (forums with participants)
        if (trending === 'true') {
            filteredForums = filteredForums.filter(forum => forum.participants > 0);
        }
        
        // Sort by participant count (most active first), then by creation date
        filteredForums.sort((a, b) => {
            if (b.participants !== a.participants) {
                return b.participants - a.participants;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        return res.status(200).json(filteredForums);
    } catch (error) {
        console.error('Get forums error:', error);
        return res.status(500).json({ error: 'Failed to fetch forums' });
    }
}

async function handleCreateForum(req, res) {
    const { title, topic, hostId } = req.body;
    
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Forum title is required' });
    }
    
    if (!hostId) {
        return res.status(400).json({ error: 'Host ID is required' });
    }
    
    // Verify user exists
    const user = await redis.get(`user:${hostId}`);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const forumId = nanoid();
    const forum = {
        id: forumId,
        title: title.trim(),
        topic: topic || 'general',
        host: user.displayName,
        hostId,
        participants: 0,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
    };
    
    // Store forum
    await redis.set(`forum:${forumId}`, forum);
    await redis.sadd('forums', forumId);
    
    // Update user's created forums count
    if (user.forumsCreated) {
        user.forumsCreated++;
    } else {
        user.forumsCreated = 1;
    }
    await redis.set(`user:${hostId}`, user);
    
    // Broadcast forum creation to all connected users
    await broadcastEvent({
        type: 'forum_created',
        forum: { ...forum, participants: 0 }
    });
    
    return res.status(201).json(forum);
}

async function handleJoinForum(req, res, forumId) {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Verify forum and user exist
    const [forum, user] = await Promise.all([
        redis.get(`forum:${forumId}`),
        redis.get(`user:${userId}`)
    ]);
    
    if (!forum) {
        return res.status(404).json({ error: 'Forum not found' });
    }
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user is already in the forum
    const isAlreadyParticipant = await redis.sismember(`forum:${forumId}:participants`, userId);
    
    if (!isAlreadyParticipant) {
        // Add user to forum participants
        await redis.sadd(`forum:${forumId}:participants`, userId);
        await redis.sadd(`user:${userId}:forums`, forumId);
        
        // Update user's discussions joined
        if (!user.discussionsJoined.includes(forumId)) {
            user.discussionsJoined.push(forumId);
            await redis.set(`user:${userId}`, user);
        }
    }
    
    // Get updated participant count
    const participants = await redis.scard(`forum:${forumId}:participants`) || 0;
    
    // Update forum's last activity
    forum.lastActivity = new Date().toISOString();
    await redis.set(`forum:${forumId}`, forum);
    
    // Broadcast user joined event
    if (!isAlreadyParticipant) {
        await broadcastEvent({
            type: 'user_joined',
            roomId: forumId,
            userId,
            userName: user.displayName,
            participants
        });
    }
    
    return res.status(200).json({ ...forum, participants });
}

async function handleLeaveForum(req, res, forumId) {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    const user = await redis.get(`user:${userId}`);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove user from forum participants
    await redis.srem(`forum:${forumId}:participants`, userId);
    await redis.srem(`user:${userId}:forums`, forumId);
    
    // Get updated participant count
    const participants = await redis.scard(`forum:${forumId}:participants`) || 0;
    
    // Broadcast user left event
    await broadcastEvent({
        type: 'user_left',
        roomId: forumId,
        userId,
        userName: user.displayName,
        participants
    });
    
    return res.status(200).json({ success: true, participants });
}

async function broadcastEvent(event) {
    try {
        // Get all active SSE connections
        const connections = await redis.smembers('sse:connections') || [];
        
        // Queue event for each connection
        const promises = connections.map(async (connId) => {
            try {
                await redis.lpush(`sse:queue:${connId}`, JSON.stringify(event));
                // Set expiry on queue items (1 hour)
                await redis.expire(`sse:queue:${connId}`, 3600);
            } catch (error) {
                console.error(`Failed to queue event for connection ${connId}:`, error);
            }
        });
        
        await Promise.all(promises);
    } catch (error) {
        console.error('Broadcast error:', error);
    }
}
