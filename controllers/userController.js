import { UsersRepository } from '../repositories/users.repository.js';
import { ProjectsRepository } from '../repositories/projects.repository.js';

export const getProfile = async (req, res) => {
  try {
    const user = await UsersRepository.findProfileById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario nao encontrado.' });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
};

export const getProjects = async (req, res) => {
  try {
    const projects = await ProjectsRepository.listByUser(req.user.id);
    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar projetos.' });
  }
};
