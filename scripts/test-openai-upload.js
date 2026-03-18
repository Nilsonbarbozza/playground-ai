import fs from 'fs';

async function run() {
  const form = new FormData();
  form.append('prompt', 'mudar a cor de background para black');
  
  const imgPath = 'c:/Users/Ti/Desktop/teste-cloner/images/img_0509abef.png';
  const imgData = fs.readFileSync(imgPath);
  
  // Use File object for native FormData in Node > 18
  const file = new File([imgData], 'image.png', { type: 'image/png' });
  form.append('image', file);

  console.log('--- Sending test request to local API ---');
  try {
    const res = await fetch('http://localhost:3000/api/edit', {
      method: 'POST',
      body: form
    });
    
    const text = await res.text();
    console.log('HTTP Status:', res.status);
    console.log('Response Details:', text);
  } catch (err) {
    console.error('Network Error:', err.message);
  }
}

run();
