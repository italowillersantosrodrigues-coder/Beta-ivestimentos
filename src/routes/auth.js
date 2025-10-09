// src/routes/auth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';

dotenv.config();

const router = express.Router();

/**
 * Rota de login do administrador
 * Valida credenciais no MongoDB e retorna token JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validação básica
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    // Busca admin no banco
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Compara senha com hash
    const senhaOk = await bcrypt.compare(password, admin.passwordHash);
    if (!senhaOk) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Gera token JWT
    const payload = { role: 'admin', email: admin.email, id: admin._id };
    const secret = process.env.JWT_SECRET || 'dev_secret'; // ⚠️ precisa existir no Render
    const token = jwt.sign(payload, secret, { expiresIn: '12h' });

    res.json({ token });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

export default router;
