import { promises as fsPromises } from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Storage Service - Level 4 (Stateless Ready)
 * Standardizes how assets are saved and URL-mapped.
 * Seamlessly switches between Local and Cloudinary storage.
 */
export class StorageService {
  /**
   * Save a buffer to consistent storage
   * @param {Buffer} buffer 
   * @param {string} prefix e.g. 'gen', 'edit', 'vid'
   * @param {string} ext e.g. 'png', 'mp4'
   */
  static async save(buffer, prefix, ext = 'png') {
    const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    
    // Cloudinary Storage Driver (Stateless)
    if (process.env.CLOUDINARY_URL) {
      try {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              public_id: filename.replace(`.${ext}`, ''),
              folder: 'playground_assets',
              resource_type: 'auto'
            },
            (error, result) => {
              if (error) {
                console.error('[STORAGE_ERR] Cloudinary upload failed:', error);
                reject(error);
              } else {
                resolve(result.secure_url);
              }
            }
          );
          uploadStream.end(buffer);
        });
      } catch (err) {
        console.error('[STORAGE_ERR] Cloudinary initialization error:', err);
        // Fallback to local will happen below if we don't throw
      }
    }

    // Local Storage Driver (Stateful - Dev Fallback)
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filepath = path.join(uploadsDir, filename);

    try {
      await fsPromises.mkdir(uploadsDir, { recursive: true });
      await fsPromises.writeFile(filepath, buffer);
      return `/uploads/${filename}`;
    } catch (err) {
      console.error('[STORAGE_ERR] Local write failed:', err);
      throw new Error('Falha ao salvar arquivo no armazenamento.');
    }
  }
}
