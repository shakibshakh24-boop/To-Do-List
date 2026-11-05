const db = require("./database");

// Create the tasks table. Existing task data is preserved.
db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        due_date TEXT,
        due_time TEXT,
        priority TEXT NOT NULL DEFAULT 'Medium',
        category TEXT NOT NULL DEFAULT 'Personal',
        recurrence TEXT NOT NULL DEFAULT 'None',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`);

function ensureColumn(name, definition) {
    const columns = db.prepare("PRAGMA table_info(tasks)").all();

    if (!columns.some(column => column.name === name)) {
        db.exec(`ALTER TABLE tasks ADD COLUMN ${name} ${definition}`);
    }
}

ensureColumn("due_date", "TEXT");
ensureColumn("due_time", "TEXT");
ensureColumn("priority", "TEXT NOT NULL DEFAULT 'Medium'");
ensureColumn("category", "TEXT NOT NULL DEFAULT 'Personal'");
ensureColumn("recurrence", "TEXT NOT NULL DEFAULT 'None'");

module.exports = db;