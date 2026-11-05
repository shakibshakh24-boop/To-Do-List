require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const db = require("./tasks");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 8000;
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing from your .env file.");
}

if (isProduction) app.set("trust proxy", 1);

function isValidDate(date) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === date;
}

function isValidTime(time) {
    return typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

function isValidPriority(priority) {
    return ["High", "Medium", "Low"].includes(priority);
}

function isValidCategory(category) {
    return typeof category === "string" &&
        category.trim().length >= 1 && category.trim().length <= 40;
}

function isValidRecurrence(recurrence) {
    return ["None", "Daily", "Weekly", "Monthly"].includes(recurrence);
}

function addRecurrence(dateString, recurrence) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (recurrence === "Daily") date.setDate(date.getDate() + 1);
    if (recurrence === "Weekly") date.setDate(date.getDate() + 7);

    if (recurrence === "Monthly") {
        const originalDay = date.getDate();
        date.setDate(1);
        date.setMonth(date.getMonth() + 1);

        const lastDay = new Date(
            date.getFullYear(),
            date.getMonth() + 1,
            0
        ).getDate();

        date.setDate(Math.min(originalDay, lastDay));
    }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}

app.use(helmet());
app.use(express.json({ limit: "10kb" }));

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

app.use(express.static(path.join(__dirname, "public")));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." }
});

function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: "You must be logged in." });
    }

    next();
}

app.get("/api/test", (req, res) => {
    res.json({ message: "Backend is working!" });
});

app.post("/api/register", authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (typeof username !== "string" || typeof password !== "string") {
            return res.status(400).json({
                error: "Username and password are required."
            });
        }

        const cleanUsername = username.trim();

        if (cleanUsername.length < 3 || cleanUsername.length > 30) {
            return res.status(400).json({
                error: "Username must be 3–30 characters."
            });
        }

        if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
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

        req.session.regenerate(error => {
            if (error) {
                console.error(error);

                return res.status(500).json({
                    error: "Could not create login session."
                });
            }

            req.session.userId = user.id;
            req.session.username = user.username;

            req.session.save(error => {
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

app.get("/api/me", requireAuth, (req, res) => {
    res.json({
        loggedIn: true,
        user: {
            id: req.session.userId,
            username: req.session.username
        }
    });
});

app.post("/api/logout", (req, res) => {
    if (!req.session) {
        return res.status(401).json({
            error: "You are not logged in."
        });
    }

    req.session.destroy(error => {
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

app.get("/api/tasks", requireAuth, (req, res) => {
    const tasks = db.prepare(`
        SELECT
            id,
            title,
            completed,
            due_date,
            due_time,
            priority,
            category,
            recurrence,
            created_at
        FROM tasks
        WHERE user_id = ?
    `).all(req.session.userId);

    res.json({ tasks });
});

app.post("/api/tasks", requireAuth, (req, res) => {
    const {
        title,
        dueDate,
        dueTime,
        priority,
        category,
        recurrence
    } = req.body;

    if (
        typeof title !== "string" ||
        title.trim().length === 0 ||
        title.trim().length > 200
    ) {
        return res.status(400).json({
            error: "Task title must be between 1 and 200 characters."
        });
    }

    const cleanDate = dueDate || null;
    const cleanTime = dueTime || null;
    const cleanPriority = priority || "Medium";
    const cleanCategory = category || "Personal";
    const cleanRecurrence = recurrence || "None";

    if (cleanDate !== null && !isValidDate(cleanDate)) {
        return res.status(400).json({
            error: "Please provide a valid due date."
        });
    }

    if (cleanTime !== null && !isValidTime(cleanTime)) {
        return res.status(400).json({
            error: "Please provide a valid due time."
        });
    }

    if (cleanTime && !cleanDate) {
        return res.status(400).json({
            error: "A due date is required when setting a due time."
        });
    }

    if (!isValidPriority(cleanPriority)) {
        return res.status(400).json({
            error: "Please choose a valid priority."
        });
    }

    if (!isValidCategory(cleanCategory)) {
        return res.status(400).json({
            error: "Category must be between 1 and 40 characters."
        });
    }

    if (!isValidRecurrence(cleanRecurrence)) {
        return res.status(400).json({
            error: "Please choose a valid repeat option."
        });
    }

    if (cleanRecurrence !== "None" && !cleanDate) {
        return res.status(400).json({
            error: "A due date is required for recurring tasks."
        });
    }

    const result = db.prepare(`
        INSERT INTO tasks (
            user_id,
            title,
            due_date,
            due_time,
            priority,
            category,
            recurrence
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        req.session.userId,
        title.trim(),
        cleanDate,
        cleanTime,
        cleanPriority,
        cleanCategory.trim(),
        cleanRecurrence
    );

    const task = db.prepare(`
        SELECT
            id,
            title,
            completed,
            due_date,
            due_time,
            priority,
            category,
            recurrence,
            created_at
        FROM tasks
        WHERE id = ? AND user_id = ?
    `).get(result.lastInsertRowid, req.session.userId);

    res.status(201).json({
        message: "Task created successfully!",
        task
    });
});

app.patch("/api/tasks/:id", requireAuth, (req, res) => {
    const taskId = Number(req.params.id);

    if (!Number.isSafeInteger(taskId) || taskId < 1) {
        return res.status(400).json({
            error: "Invalid task ID."
        });
    }

    const existingTask = db.prepare(`
        SELECT *
        FROM tasks
        WHERE id = ? AND user_id = ?
    `).get(taskId, req.session.userId);

    if (!existingTask) {
        return res.status(404).json({
            error: "Task not found."
        });
    }

    const allowedFields = [
        "completed",
        "dueDate",
        "dueTime",
        "priority",
        "category",
        "recurrence"
    ];

    const providedFields = allowedFields.filter(field =>
        Object.prototype.hasOwnProperty.call(req.body, field)
    );

    if (providedFields.length === 0) {
        return res.status(400).json({
            error: "No task changes were provided."
        });
    }

    if (
        Object.prototype.hasOwnProperty.call(req.body, "completed") &&
        typeof req.body.completed !== "boolean"
    ) {
        return res.status(400).json({
            error: "Completed must be true or false."
        });
    }

    const newDate = Object.prototype.hasOwnProperty.call(req.body, "dueDate")
        ? (req.body.dueDate || null)
        : existingTask.due_date;

    const newTime = Object.prototype.hasOwnProperty.call(req.body, "dueTime")
        ? (req.body.dueTime || null)
        : existingTask.due_time;

    const newPriority = req.body.priority ?? existingTask.priority;
    const newCategory = req.body.category ?? existingTask.category;
    const newRecurrence = req.body.recurrence ??
        existingTask.recurrence ??
        "None";

    if (newDate !== null && !isValidDate(newDate)) {
        return res.status(400).json({
            error: "Please provide a valid due date."
        });
    }

    if (newTime !== null && !isValidTime(newTime)) {
        return res.status(400).json({
            error: "Please provide a valid due time."
        });
    }

    if (newTime && !newDate) {
        return res.status(400).json({
            error: "A due date is required when setting a due time."
        });
    }

    if (!isValidPriority(newPriority)) {
        return res.status(400).json({
            error: "Please choose a valid priority."
        });
    }

    if (!isValidCategory(newCategory)) {
        return res.status(400).json({
            error: "Category must be between 1 and 40 characters."
        });
    }

    if (!isValidRecurrence(newRecurrence)) {
        return res.status(400).json({
            error: "Please choose a valid repeat option."
        });
    }

    if (newRecurrence !== "None" && !newDate) {
        return res.status(400).json({
            error: "A due date is required for recurring tasks."
        });
    }

    const newCompleted = Object.prototype.hasOwnProperty.call(
        req.body,
        "completed"
    )
        ? (req.body.completed ? 1 : 0)
        : existingTask.completed;

    const saveChanges = db.transaction(() => {
        db.prepare(`
            UPDATE tasks
            SET
                completed = ?,
                due_date = ?,
                due_time = ?,
                priority = ?,
                category = ?,
                recurrence = ?
            WHERE id = ? AND user_id = ?
        `).run(
            newCompleted,
            newDate,
            newDate ? newTime : null,
            newPriority,
            newCategory.trim(),
            newRecurrence,
            taskId,
            req.session.userId
        );

        // When a recurring task is completed, preserve its completed record
        // and create exactly one next occurrence.
        if (
            existingTask.completed === 0 &&
            newCompleted === 1 &&
            existingTask.recurrence &&
            existingTask.recurrence !== "None"
        ) {
            const nextDate = addRecurrence(
                existingTask.due_date,
                existingTask.recurrence
            );

            db.prepare(`
                UPDATE tasks
                SET recurrence = 'None'
                WHERE id = ? AND user_id = ?
            `).run(taskId, req.session.userId);

            db.prepare(`
                INSERT INTO tasks (
                    user_id,
                    title,
                    completed,
                    due_date,
                    due_time,
                    priority,
                    category,
                    recurrence
                )
                VALUES (?, ?, 0, ?, ?, ?, ?, ?)
            `).run(
                req.session.userId,
                existingTask.title,
                nextDate,
                existingTask.due_time,
                existingTask.priority,
                existingTask.category,
                existingTask.recurrence
            );
        }
    });

    saveChanges();

    res.json({
        message: "Task updated successfully!"
    });
});

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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});