// api/auth-simple.js - Simple auth endpoint without dependencies
module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    console.log(`Simple Auth API called: ${req.method} ${req.url}`);
    
    if (req.method === 'POST') {
        const { displayName, aboutMe, interests } = req.body;
        
        // Simple validation
        if (!displayName || displayName.trim().length === 0) {
            return res.status(400).json({ error: 'Display name is required' });
        }
        
        // Generate a simple ID
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Return a mock user response
        const mockUser = {
            id: userId,
            displayName: displayName.trim(),
            aboutMe: aboutMe ? aboutMe.trim() : '',
            interests: Array.isArray(interests) ? interests : [],
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
        
        console.log('User created successfully:', mockUser);
        return res.status(200).json(mockUser);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
} 