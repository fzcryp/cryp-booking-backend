import db from "./src/config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createSavedHotelsTable = () => {
    const schemaPath = path.join(__dirname, "saved_hotels_schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");

    db.query(sql, (err, result) => {
        if (err) {
            console.error("❌ Error creating saved_hotels table:", err);
        } else {
            console.log("✅ saved_hotels table created successfully or already exists.");
        }
        process.exit();
    });
};

createSavedHotelsTable();
