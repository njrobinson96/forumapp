// api/auth.js - Upgraded v2.0
const { Redis } = require('@upstash/redis');
const redis = Redis.fromEnv();
const { nanoid } = require('nanoid');

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

module.exports = async function handler(req, res) {
    // Enhanced CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    console.log(`Auth API called: ${req.method} ${req.url}`);
    
    try {
        // Rate limiting
        const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const rateLimitKey = `rate_limit:auth:${clientIP}`;
        
        const currentRequests = await redis.get(rateLimitKey) || 0;
        if (currentRequests >= MAX_REQUESTS_PER_WINDOW) {
            return res.status(429).json({ 
                error: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
            });
        }
        
        // Increment rate limit counter
        await redis.incr(rateLimitKey);
        await redis.expire(rateLimitKey, Math.ceil(RATE_LIMIT_WINDOW / 1000));
        
        if (req.method === 'POST') {
            return await handleCreateUser(req, res);
        }
        
        if (req.method === 'GET') {
            return await handleGetUser(req, res);
        }
        
        if (req.method === 'DELETE') {
            return await handleSignOut(req, res);
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Auth error:', error);
        console.error('Error stack:', error.stack);
        console.error('Redis connection status:', redis ? 'Connected' : 'Not connected');
        
        return res.status(500).json({ 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

async function handleCreateUser(req, res) {
    const { displayName, aboutMe, interests } = req.body;
    console.log('Creating user with:', { displayName, aboutMe, interests });
    
    // Enhanced validation
    if (!displayName || displayName.trim().length === 0) {
        return res.status(400).json({ error: 'Display name is required' });
    }
    
    if (displayName.trim().length < 2) {
        return res.status(400).json({ error: 'Display name must be at least 2 characters long' });
    }
    
    if (displayName.trim().length > 50) {
        return res.status(400).json({ error: 'Display name must be less than 50 characters' });
    }
    
    // Sanitize input
    const sanitizedName = displayName.trim().replace(/[<>]/g, '');
    const sanitizedAboutMe = aboutMe ? aboutMe.trim().replace(/[<>]/g, '').substring(0, 200) : '';
    const sanitizedInterests = Array.isArray(interests) ? interests.slice(0, 10) : [];
    
    try {
        // Check for duplicate display names with case-insensitive search
        const existingUsers = await redis.smembers('users');
        console.log('Existing users count:', existingUsers.length);
        
        for (const existingUserId of existingUsers) {
            const existingUser = await redis.get(`user:${existingUserId}`);
            if (existingUser && existingUser.displayName.toLowerCase() === sanitizedName.toLowerCase()) {
                return res.status(409).json({ error: 'Display name already taken' });
            }
        }
        
        const userId = nanoid();
        const user = {
            id: userId,
            displayName: sanitizedName,
            aboutMe: sanitizedAboutMe,
            interests: sanitizedInterests,
            joinedAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            messageCount: 0,
            discussionsJoined: [],
            isOnline: true,
            profile: {
                avatar: null,
                banner: null,
                location: null,
                website: null
            },
            preferences: {
                notifications: true,
                emailUpdates: false,
                theme: 'dark',
                language: 'en'
            },
            stats: {
                totalMessages: 0,
                forumsCreated: 0,
                forumsJoined: 0,
                reputation: 0
            }
        };
        
        console.log('Storing user:', user);
        
        // Store user with enhanced data structure
        await Promise.all([
            redis.set(`user:${userId}`, user),
            redis.sadd('users', userId),
            redis.sadd('activeUsers', userId),
            redis.set(`user:${userId}:session`, {
                createdAt: Date.now(),
                lastActivity: Date.now(),
                userAgent: req.headers['user-agent'] || 'unknown'
            }, { ex: 86400 }) // 24 hour session
        ]);
        
        // Set user session expiry (24 hours)
        await redis.expire(`user:${userId}`, 86400);
        
        console.log('User created successfully');
        return res.status(200).json(user);
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ error: 'Failed to create user' });
    }
}

async function handleGetUser(req, res) {
    const { userId } = req.query;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    try {
        const user = await redis.get(`user:${userId}`);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update session activity
        const session = await redis.get(`user:${userId}:session`);
        if (session) {
            session.lastActivity = Date.now();
            await redis.set(`user:${userId}:session`, session, { ex: 86400 });
        }
        
        // Update last active timestamp
        user.lastActive = new Date().toISOString();
        user.isOnline = true;
        await redis.set(`user:${userId}`, user);
        await redis.sadd('activeUsers', userId);
        
        return res.status(200).json(user);
    } catch (error) {
        console.error('Error getting user:', error);
        return res.status(500).json({ error: 'Failed to get user' });
    }
}

async function handleSignOut(req, res) {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    try {
        // Update user status to offline
        const user = await redis.get(`user:${userId}`);
        if (user) {
            user.isOnline = false;
            user.lastActive = new Date().toISOString();
            await redis.set(`user:${userId}`, user);
        }
        
        // Clean up session and active status
        await Promise.all([
            redis.srem('activeUsers', userId),
            redis.del(`user:${userId}:session`)
        ]);
        
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error signing out user:', error);
        return res.status(500).json({ error: 'Failed to sign out' });
    }
}
