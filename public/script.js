
// Select authentication elements
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const logoutButton = document.getElementById("logout-btn");
const usernameDisplay = document.getElementById("username-display");

// Select task elements
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");

// Select filter buttons
const allBtn = document.getElementById("all-btn");
const activeBtn = document.getElementById("active-btn");
const completedBtn = document.getElementById("completed-btn");

// Status message
const message = document.getElementById("message");

// Store tasks loaded from the backend
let tasks = [];

// Current filter
let currentFilter = "all";

// Show a message to the user
function showMessage(text, type = "") {
    message.textContent = text;
    message.className = "message";

    if (type) {
        message.classList.add(type);
    }
}

// Communicate with the backend
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
            ...(options.body ? {
                "Content-Type": "application/json"
            } : {}),
            ...options.headers
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

// Display the correct section
function showApp(isLoggedIn) {
    authSection.hidden = isLoggedIn;
    appSection.hidden = !isLoggedIn;
}

// Load tasks from the database
async function loadTasks() {
    try {
        const data = await apiRequest("/api/tasks");

        tasks = data.tasks.map(task => ({
            ...task,
            completed: Boolean(task.completed)
        }));

        renderTasks();

    } catch (error) {
        showMessage(error.message, "error");
    }
}

// Change the selected filter
function setFilter(filter) {
    currentFilter = filter;

    allBtn.classList.toggle("selected", filter === "all");
    activeBtn.classList.toggle("selected", filter === "active");
    completedBtn.classList.toggle("selected", filter === "completed");

    renderTasks();
}

// Display tasks
function renderTasks() {
    taskList.innerHTML = "";

    const filteredTasks = tasks.filter(task => {
        if (currentFilter === "active") {
            return !task.completed;
        }

        if (currentFilter === "completed") {
            return task.completed;
        }

        return true;
    });

    if (filteredTasks.length === 0) {
        const emptyMessage = document.createElement("li");
        emptyMessage.textContent = "No tasks to display.";
        emptyMessage.classList.add("task-item");
        taskList.appendChild(emptyMessage);
        return;
    }

    filteredTasks.forEach(task => {
        const li = document.createElement("li");
        li.classList.add("task-item");

        if (task.completed) {
            li.classList.add("completed");
        }

        // Create checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", "Complete " + task.title);

        // Update task completion
        checkbox.addEventListener("change", async () => {
            try {
                await apiRequest(`/api/tasks/${task.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        completed: checkbox.checked
                    })
                });

                task.completed = checkbox.checked;
                renderTasks();

            } catch (error) {
                checkbox.checked = task.completed;
                showMessage(error.message, "error");
            }
        });

        // Create task text
        const span = document.createElement("span");
        span.classList.add("task-text");
        span.textContent = task.title;

        // Create delete button
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.classList.add("delete-btn");
        deleteButton.setAttribute("aria-label", "Delete " + task.title);

        // Delete task
        deleteButton.addEventListener("click", async () => {
            try {
                await apiRequest(`/api/tasks/${task.id}`, {
                    method: "DELETE"
                });

                tasks = tasks.filter(item => item.id !== task.id);
                renderTasks();
                showMessage("Task deleted successfully!", "success");

            } catch (error) {
                showMessage(error.message, "error");
            }
        });

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteButton);

        taskList.appendChild(li);
    });
}

// Register a new account
registerForm.addEventListener("submit", async event => {
    event.preventDefault();

    const username = document.getElementById("register-username").value;
    const password = document.getElementById("register-password").value;

    try {
        const data = await apiRequest("/api/register", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });

        showMessage(data.message + " You can now log in.", "success");
        registerForm.reset();

    } catch (error) {
        showMessage(error.message, "error");
    }
});

// Log in
loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    try {
        const data = await apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });

        usernameDisplay.textContent = data.user.username;

        loginForm.reset();
        showApp(true);
        showMessage("Login successful!", "success");

        await loadTasks();

    } catch (error) {
        showMessage(error.message, "error");
    }
});

// Log out
logoutButton.addEventListener("click", async () => {
    try {
        const data = await apiRequest("/api/logout", {
            method: "POST"
        });

        tasks = [];
        taskList.innerHTML = "";

        showApp(false);
        showMessage(data.message, "success");

    } catch (error) {
        showMessage(error.message, "error");
    }
});

// Add a new task
taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    const title = taskInput.value.trim();

    if (title === "") {
        return;
    }

    try {
        const data = await apiRequest("/api/tasks", {
            method: "POST",
            body: JSON.stringify({ title })
        });

        tasks.unshift({
            ...data.task,
            completed: Boolean(data.task.completed)
        });

        taskInput.value = "";
        taskInput.focus();

        renderTasks();
        showMessage("Task added successfully!", "success");

    } catch (error) {
        showMessage(error.message, "error");
    }
});

// Filter button events
allBtn.addEventListener("click", () => {
    setFilter("all");
});

activeBtn.addEventListener("click", () => {
    setFilter("active");
});

completedBtn.addEventListener("click", () => {
    setFilter("completed");
});

// Check whether the user is already logged in
async function checkLoginStatus() {
    try {
        const data = await apiRequest("/api/me");

        usernameDisplay.textContent = data.user.username;
        showApp(true);

        await loadTasks();

    } catch (error) {
        showApp(false);
    }
}

// Initial setup
setFilter("all");
checkLoginStatus();
