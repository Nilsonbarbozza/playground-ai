import db from '../config/db.js';

export const getProfile = async (req, res) => {
  try {
    const result = await db.query('SELECT id, email, credits, created_at FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
};

export const getProjects = async (req, res) => {
  try {
    const result = await db.query('SELECT id, prompt, image_url, module, created_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ success: true, projects: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar projetos.' });
  }
};
