module.exports = async function handler(req, res) {
    console.log('Ping API called:', req.method, req.url);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    return res.status(200).json({
        message: 'pong',
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url
    });
} 