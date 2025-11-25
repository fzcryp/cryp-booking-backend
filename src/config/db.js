import mysql from "mysql2";

const db = mysql.createConnection({
  host: "localhost", // XAMPP MySQL host
  user: "root", // default user for XAMPP
  password: "", // leave empty unless you set one
  database: "cryp_booking", // your DB name
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL database.");
  }
});

export default db;
