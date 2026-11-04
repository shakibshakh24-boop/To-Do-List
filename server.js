
require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const db = require("./tasks");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = 3000;
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing from your .env file.");
}

// Trust proxy when deployed behind HTTPS hosting
if (isProduction) {
    app.set("trust proxy", 1);
}

// Middleware
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

// Session configuration
app.use(session({
    name: "todo.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

// Authentication rate limiter
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        error: "Too many attempts. Please try again later."
    }
});

// Require login before accessing protected routes
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            error: "You must be logged in."
        });
    }

    next();
}

// Test API
app.get("/api/test", (req, res) => {
    res.json({
        message: "Backend is working!"
    });
});

// Register API
app.post("/api/register", authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (
            typeof username !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                error: "Username and password are required."
            });
        }

        const cleanUsername = username.trim();

        if (
            cleanUsername.length < 3 ||
            cleanUsername.length > 30
        ) {
            return res.status(400).json({
                error: "Username must be 3–30 characters."
            });
        }

        if (
            password.length < 12 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                error: "Password must be at least 12 characters and no more than 72 UTF-8 bytes."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = db.prepare(`
            INSERT INTO users (username, password_hash)
            VALUES (?, ?)
        `).run(cleanUsername, hashedPassword);

        return res.status(201).json({
            message: "Account created successfully!",
            userId: result.lastInsertRowid
        });

    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                error: "Username is already taken."
            });
        }

        console.error(error);

        return res.status(500).json({
            error: "Something went wrong."
        });
    }
});

// Login API
app.post("/api/login", authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (
            typeof username !== "string" ||
            typeof password !== "string" ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                error: "Invalid username or password."
            });
        }

        const user = db.prepare(`
            SELECT id, username, password_hash
            FROM users
            WHERE username = ?
        `).get(username.trim());

        if (!user) {
            return res.status(401).json({
                error: "Incorrect username or password."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                error: "Incorrect username or password."
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                console.error(error);
                return res.status(500).json({
                    error: "Could not create login session."
                });
            }

            req.session.userId = user.id;
            req.session.username = user.username;

            req.session.save((error) => {
                if (error) {
                    console.error(error);
                    return res.status(500).json({
                        error: "Could not save login session."
                    });
                }

                return res.json({
                    message: "Login successful!",
                    user: {
                        id: user.id,
                        username: user.username
                    }
                });
            });
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Something went wrong."
        });
    }
});

// Check login status
app.get("/api/me", requireAuth, (req, res) => {
    res.json({
        loggedIn: true,
        user: {
            id: req.session.userId,
            username: req.session.username
        }
    });
});

// Logout API
app.post("/api/logout", (req, res) => {
    if (!req.session) {
        return res.status(401).json({
            error: "You are not logged in."
        });
    }

    req.session.destroy((error) => {
        if (error) {
            console.error(error);
            return res.status(500).json({
                error: "Could not log out."
            });
        }

        res.clearCookie("todo.sid", {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax"
        });

        return res.json({
            message: "Logged out successfully!"
        });
    });
});

// GET: Retrieve the logged-in user's tasks
app.get("/api/tasks", requireAuth, (req, res) => {
    const tasks = db.prepare(`
        SELECT id, title, completed, created_at
        FROM tasks
        WHERE user_id = ?
        ORDER BY id DESC
    `).all(req.session.userId);

    res.json({ tasks });
});

// POST: Create a task
app.post("/api/tasks", requireAuth, (req, res) => {
    const { title } = req.body;

    if (
        typeof title !== "string" ||
        title.trim().length === 0 ||
        title.trim().length > 200
    ) {
        return res.status(400).json({
            error: "Task title must be between 1 and 200 characters."
        });
    }

    const result = db.prepare(`
        INSERT INTO tasks (user_id, title)
        VALUES (?, ?)
    `).run(req.session.userId, title.trim());

    const task = db.prepare(`
        SELECT id, title, completed, created_at
        FROM tasks
        WHERE id = ? AND user_id = ?
    `).get(result.lastInsertRowid, req.session.userId);

    res.status(201).json({
        message: "Task created successfully!",
        task
    });
});

// PATCH: Mark a task complete or incomplete
app.patch("/api/tasks/:id", requireAuth, (req, res) => {
    const taskId = Number(req.params.id);
    const { completed } = req.body;

    if (
        !Number.isSafeInteger(taskId) ||
        taskId < 1 ||
        typeof completed !== "boolean"
    ) {
        return res.status(400).json({
            error: "A valid task ID and completed value are required."
        });
    }

    const result = db.prepare(`
        UPDATE tasks
        SET completed = ?
        WHERE id = ? AND user_id = ?
    `).run(
        completed ? 1 : 0,
        taskId,
        req.session.userId
    );

    if (result.changes === 0) {
        return res.status(404).json({
            error: "Task not found."
        });
    }

    res.json({
        message: "Task updated successfully!"
    });
});

// DELETE: Delete a task
app.delete("/api/tasks/:id", requireAuth, (req, res) => {
    const taskId = Number(req.params.id);

    if (!Number.isSafeInteger(taskId) || taskId < 1) {
        return res.status(400).json({
            error: "Invalid task ID."
        });
    }

    const result = db.prepare(`
        DELETE FROM tasks
        WHERE id = ? AND user_id = ?
    `).run(taskId, req.session.userId);

    if (result.changes === 0) {
        return res.status(404).json({
            error: "Task not found."
        });
    }

    res.json({
        message: "Task deleted successfully!"
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
