import multer from 'multer';

// Configuration: Strictly memory storage for ephemerality and performance
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});
