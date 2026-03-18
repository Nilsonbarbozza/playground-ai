import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';
import sharp from 'sharp';

dotenv.config();

const openai = new OpenAI();
const imgPath = 'c:/Users/Ti/Desktop/teste-cloner/images/img_0509abef.png';

async function test() {
  try {
    console.log('Processing image with Sharp...');
    const buffer = await sharp(imgPath)
      .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .png()
      .toBuffer();

    console.log('Sending to OpenAI...');
    
    const response = await openai.images.edit({
      model: "dall-e-2",
      image: await OpenAI.toFile(buffer, 'image.png', { type: 'image/png' }),
      prompt: "mudar a cor de background para black",
      n: 1,
      size: "1024x1024",
    });

    console.log('Success:', response.data[0].url);
  } catch (err) {
    if (err.response) {
      console.error('API Error Details (HTTP ' + err.status + '):', err.response.data);
    } else {
      console.error('Error Details:', err.message);
    }
  }
}

test();
