import { ProjectsRepository } from '../../repositories/projects.repository.js';

export class ProjectsService {
  static async createVideoProjectIfMissingWithClient(client, { userId, providerJobId, videoUrl }) {
    const prompt = `Stability Video: ${providerJobId}`;
    const existing = await ProjectsRepository.findVideoProjectByPromptWithClient(client, { userId, prompt });
    if (existing) return existing;
    return ProjectsRepository.createWithClient(client, {
      userId,
      prompt,
      imageUrl: videoUrl,
      module: 'video'
    });
  }
}
