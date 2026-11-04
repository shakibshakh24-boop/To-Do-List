
const Database = require("better-sqlite3");
const path = require("path");

// Connect to the SQLite database
const db = new Database(path.join(__dirname, "users.db"));

// Enable foreign-key relationships
db.pragma("foreign_keys = ON");

// Create the users table
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

module.exports = db;
