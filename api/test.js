export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    console.log('Test API called:', req.method, req.url);
    
    return res.status(200).json({
        message: 'API is working!',
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString()
    });
} 