// api/sse.js - Upgraded v2.0
const { Redis } = require('@upstash/redis');
const redis = Redis.fromEnv();

module.exports = async function handler(req, res) {
    const { userId } = req.query;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    try {
        // Verify user exists
        const user = await redis.get(`user:${userId}`);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        
        const connectionId = nanoid();
        
        // Register connection with metadata
        await Promise.all([
            redis.sadd('sse:connections', connectionId),
            redis.set(`sse:connection:${connectionId}`, {
                userId,
                connectedAt: Date.now(),
                lastHeartbeat: Date.now(),
                userAgent: req.headers['user-agent'] || 'unknown'
            }, { ex: 3600 }) // 1 hour expiry
        ]);
        
        // Update user's online status
        const updatedUser = { ...user, isOnline: true, lastActive: new Date().toISOString() };
        await redis.set(`user:${userId}`, updatedUser);
        await redis.sadd('activeUsers', userId);
        
        // Send initial connection event
        const initialEvent = {
            type: 'connected',
            connectionId,
            timestamp: new Date().toISOString(),
            user: {
                id: user.id,
                displayName: user.displayName
            }
        };
        
        res.write(`data: ${JSON.stringify(initialEvent)}\n\n`);
        
        // Set up heartbeat (every 30 seconds)
        const heartbeat = setInterval(async () => {
            try {
                res.write(`: heartbeat ${Date.now()}\n\n`);
                
                // Update connection heartbeat timestamp
                await redis.hset(`sse:connection:${connectionId}`, 'lastHeartbeat', Date.now());
            } catch (error) {
                console.error('Heartbeat error:', error);
                clearInterval(heartbeat);
            }
        }, 30000);
        
        // Check for queued messages (every 100ms for real-time feel)
        const messageCheck = setInterval(async () => {
            try {
                // Get messages from queue
                const messages = await redis.lrange(`sse:queue:${connectionId}`, 0, -1);
                
                if (messages && messages.length > 0) {
                    // Send each message
                    for (const message of messages) {
                        try {
                            const parsedMessage = JSON.parse(message);
                            
                            // Add timestamp if not present
                            if (!parsedMessage.timestamp) {
                                parsedMessage.timestamp = new Date().toISOString();
                            }
                            
                            res.write(`data: ${JSON.stringify(parsedMessage)}\n\n`);
                        } catch (parseError) {
                            console.error('Failed to parse message:', parseError);
                        }
                    }
                    
                    // Clear processed messages
                    await redis.del(`sse:queue:${connectionId}`);
                }
                
                // Also check for any typing indicators for forums user is in
                await sendTypingUpdates(res, userId, connectionId);
                
            } catch (error) {
                console.error('SSE message check error:', error);
            }
        }, 100);
        
        // Connection timeout (15 minutes)
        const connectionTimeout = setTimeout(async () => {
            console.log(`Connection ${connectionId} timed out`);
            await cleanupConnection(connectionId, userId);
            res.end();
        }, 900000); // 15 minutes
        
        // Clean up on connection close
        const cleanup = async () => {
            clearInterval(heartbeat);
            clearInterval(messageCheck);
            clearTimeout(connectionTimeout);
            
            await cleanupConnection(connectionId, userId);
        };
        
        req.on('close', cleanup);
        req.on('error', (error) => {
            console.error('SSE connection error:', error);
            cleanup();
        });
        
        // Keep connection alive
        if (req.socket) {
            req.socket.setTimeout(0);
            req.socket.setNoDelay(true);
            req.socket.setKeepAlive(true, 30000);
        }
        
    } catch (error) {
        console.error('SSE initialization error:', error);
        return res.status(500).json({ error: 'Failed to establish SSE connection' });
    }
}

async function sendTypingUpdates(res, userId, connectionId) {
    try {
        // Get forums user is participating in
        const userForums = await redis.smembers(`user:${userId}:forums`) || [];
        
        for (const forumId of userForums) {
            // Get all typing users in this forum
            const typingKeys = await redis.keys(`typing:${forumId}:*`);
            const typingUsers = {};
            
            for (const key of typingKeys) {
                const typingUserId = key.split(':')[2];
                if (typingUserId !== userId) { // Don't send own typing status
                    const userName = await redis.get(key);
                    if (userName) {
                        typingUsers[typingUserId] = userName;
                    }
                }
            }
            
            // Send typing update if there are typing users
            if (Object.keys(typingUsers).length > 0) {
                const typingEvent = {
                    type: 'typing_update',
                    roomId: forumId,
                    typingUsers,
                    timestamp: new Date().toISOString()
                };
                
                res.write(`data: ${JSON.stringify(typingEvent)}\n\n`);
            }
        }
    } catch (error) {
        console.error('Typing updates error:', error);
    }
}

async function cleanupConnection(connectionId, userId) {
    try {
        // Remove connection from active connections
        await Promise.all([
            redis.srem('sse:connections', connectionId),
            redis.del(`sse:connection:${connectionId}`),
            redis.del(`sse:queue:${connectionId}`)
        ]);
        
        // Check if user has other active connections
        const allConnections = await redis.smembers('sse:connections');
        let hasOtherConnections = false;
        
        for (const connId of allConnections) {
            try {
                const connData = await redis.get(`sse:connection:${connId}`);
                if (connData && connData.userId === userId) {
                    hasOtherConnections = true;
                    break;
                }
            } catch (error) {
                console.error(`Error checking connection ${connId}:`, error);
                // Remove invalid connection
                await redis.srem('sse:connections', connId);
                await redis.del(`sse:connection:${connId}`);
            }
        }
        
        // If no other connections, mark user as offline
        if (!hasOtherConnections) {
            try {
                const user = await redis.get(`user:${userId}`);
                if (user) {
                    user.isOnline = false;
                    user.lastActive = new Date().toISOString();
                    await redis.set(`user:${userId}`, user);
                }
                await redis.srem('activeUsers', userId);
            } catch (error) {
                console.error('Error updating user offline status:', error);
            }
        }
        
        console.log(`Cleaned up connection ${connectionId} for user ${userId}`);
    } catch (error) {
        console.error('Connection cleanup error:', error);
    }
}

// Utility function to broadcast to specific user
export async function broadcastToUser(userId, event) {
    try {
        const connections = await redis.smembers('sse:connections');
        
        for (const connId of connections) {
            const connData = await redis.get(`sse:connection:${connId}`);
            if (connData && connData.userId === userId) {
                await redis.lpush(`sse:queue:${connId}`, JSON.stringify(event));
                await redis.expire(`sse:queue:${connId}`, 1800); // 30 minutes
            }
        }
    } catch (error) {
        console.error('Broadcast to user error:', error);
    }
}
