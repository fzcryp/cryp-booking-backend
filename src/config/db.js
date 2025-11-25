import mysql from "mysql2";

const db = mysql.createConnection({
  host: "premium704.web-hosting.com", // XAMPP MySQL host
  user: "crypenxz_hemdip", // default user for XAMPP
  password: "Hemdip@payval7108", // leave empty unless you set one
  database: "crypenxz_cryp_booking", // your DB name
  port: 3306,
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL database.");
  }
});

export default db;
