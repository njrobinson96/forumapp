module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    console.log('Debug API called:', req.method, req.url);
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    
    return res.status(200).json({
        message: 'Debug API is working!',
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production'
    });
} 