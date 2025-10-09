// scripts/set_temp_passwords.mjs
import "./src/db/mongo.js";
import User from "./src/models/User.js";
import bcrypt from "bcryptjs";
import fs from "fs";
import crypto from "crypto";
import path from "path";

function randPass(len = 12) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len);
}

async function main() {
  const users = await User.find({ $or: [{ senhaHash: { $exists: false } }, { senhaHash: null }] }).lean();
  console.log("Usuários sem senhaHash encontrados:", users.length);

  const out = [];
  for (const u of users) {
    const temp = randPass(12);
    const hash = await bcrypt.hash(temp, 10);
    await User.updateOne({ _id: u._id }, { $set: { senhaHash: hash } });
    out.push({ email: u.email, temp });
    console.log(`Atualizado ${u.email}`);
  }

  const csvPath = path.join(process.cwd(), "temp_passwords.csv");
  const csv = out.map(r => `${r.email},${r.temp}`).join("\n");
  fs.writeFileSync(csvPath, "email,temp_password\n" + csv, "utf8");
  console.log("Gerado CSV:", csvPath);
  console.log("Total:", out.length);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
