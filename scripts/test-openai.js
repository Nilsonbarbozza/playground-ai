import OpenAI from 'openai';
import dotenv from 'dotenv';
import sharp from 'sharp';
import fs from 'fs';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function runTest() {
  console.log('Testing OpenAI Image Edit...');
  try {
    // 1. Create a dummy square PNG with alpha
    const buffer = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.5 }
      }
    }).png().toBuffer();

    console.log('Dummy image created. Sending to OpenAI...');

    const response = await openai.images.edit({
      model: 'dall-e-2',
      image: await OpenAI.toFile(buffer, 'test.png'),
      prompt: 'Change the red background to a beautiful sunset with a small cat in the corner',
      n: 1,
      size: '1024x1024',
    });

    console.log('SUCCESS! OpenAI Response:', response.data[0].url);
  } catch (error) {
    console.error('TEST FAILED!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
      if (error.stack) console.error(error.stack);
    }
  }
}

runTest();
