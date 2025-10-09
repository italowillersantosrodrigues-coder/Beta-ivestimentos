// server-start.js
import dotenv from "dotenv";
dotenv.config(); // 🔹 primeiro

import "./src/server.js"; // depois importa o server, que importa mongo.js
