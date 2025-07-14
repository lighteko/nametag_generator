import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('Simple test endpoint called');
    
    if (req.method === 'GET') {
      return res.status(200).json({ 
        message: 'Simple test API is working',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      });
    }
    
    if (req.method === 'POST') {
      const body = req.body;
      console.log('Received POST data:', Object.keys(body || {}));
      
      return res.status(200).json({
        message: 'POST request received successfully',
        receivedFields: Object.keys(body || {}),
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Simple test failed:', error);
    res.status(500).json({ 
      error: 'Simple test failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 