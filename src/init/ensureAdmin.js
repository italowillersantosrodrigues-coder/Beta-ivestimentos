// src/init/ensureAdmin.js
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import dotenv from 'dotenv';
dotenv.config();

export default async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('ADMIN_EMAIL ou ADMIN_PASSWORD não definido — pulando seed do admin.');
    return;
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    // opcional: atualizar senha caso tenha mudado no .env
    const match = await bcrypt.compare(password, existing.passwordHash);
    if (!match) {
      existing.passwordHash = await bcrypt.hash(password, 10);
      await existing.save();
      console.log('Senha do admin atualizada a partir do .env');
    } else {
      console.log('Admin já existe — sem alterações.');
    }
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await Admin.create({ email, passwordHash: hash });
  console.log('Admin criado no banco.');
}
