// api/auth.js
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
        if (req.method === 'POST') {
            // Create new user
            const { displayName, aboutMe, interests } = req.body;
            
            if (!displayName) {
                return res.status(400).json({ error: 'Display name is required' });
            }
            
            const userId = nanoid();
            const user = {
                id: userId,
                displayName,
                aboutMe: aboutMe || '',
                interests: interests || [],
                joinedAt: new Date().toISOString(),
                messageCount: 0,
                discussionsJoined: []
            };
            
            // Store user in KV
            await kv.set(`user:${userId}`, user);
            await kv.sadd('users', userId);
            
            return res.status(200).json(user);
        }
        
        if (req.method === 'GET') {
            // Get user by ID
            const { userId } = req.query;
            
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            
            const user = await kv.get(`user:${userId}`);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            return res.status(200).json(user);
        }
        
        if (req.method === 'DELETE') {
            // Sign out user
            const { userId } = req.body;
            
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            
            // Remove from active users
            await kv.srem('activeUsers', userId);
            
            return res.status(200).json({ success: true });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}