import { NextApiRequest, NextApiResponse } from 'next';
// @ts-ignore
import { createCanvas } from '@napi-rs/canvas';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('Testing canvas creation...');
    
    // Test basic canvas creation
    const canvas = createCanvas(200, 100);
    const ctx = canvas.getContext('2d');
    
    // Test basic drawing
    ctx.fillStyle = 'blue';
    ctx.fillRect(10, 10, 50, 50);
    
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Test', 100, 50);
    
    // Test encoding
    const buffer = await canvas.encode('png');
    
    console.log('Canvas test successful, buffer size:', buffer.length);
    
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
    
  } catch (error) {
    console.error('Canvas test failed:', error);
    res.status(500).json({ 
      error: 'Canvas test failed',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
} 