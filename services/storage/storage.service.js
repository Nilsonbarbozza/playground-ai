import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Storage Service - Level 3
 * Standardizes how assets are saved and URL-mapped.
 * Easy to swap Local Storage for S3/Supabase in Phase 4.
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
    
    // In Level 3, we expect 'uploads' to be at the project root
    // We use path.join to ensure cross-platform compatibility
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filepath = path.join(uploadsDir, filename);

    // Ensure directory exists
    await fsPromises.mkdir(uploadsDir, { recursive: true });
    await fsPromises.writeFile(filepath, buffer);
    
    // Returns the relative URL for frontend consumption
    return `/uploads/${filename}`;
  }
}
