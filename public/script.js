// Authentication elements
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const logoutButton = document.getElementById("logout-btn");
const usernameDisplay = document.getElementById("username-display");

// Task form elements
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const dueDateInput = document.getElementById("due-date-input");
const dueTimeInput = document.getElementById("due-time-input");
const priorityInput = document.getElementById("priority-input");
const categoryInput = document.getElementById("category-input");
const recurrenceInput = document.getElementById("recurrence-input");
const taskList = document.getElementById("task-list");
const searchInput = document.getElementById("search-input");

// Filter buttons and messages
const allBtn = document.getElementById("all-btn");
const activeBtn = document.getElementById("active-btn");
const completedBtn = document.getElementById("completed-btn");
const message = document.getElementById("message");

// Dashboard and calendar elements
const totalCount = document.getElementById("total-count");
const completedCount = document.getElementById("completed-count");
const activeCount = document.getElementById("active-count");
const overdueCount = document.getElementById("overdue-count");
const progressBar = document.getElementById("progress-bar");
const progressLabel = document.getElementById("progress-label");
const calendarGrid = document.getElementById("calendar-grid");
const calendarMonth = document.getElementById("calendar-month");
const calendarSelection = document.getElementById("calendar-selection");
const calendarTaskList = document.getElementById("calendar-task-list");
const themeToggle = document.getElementById("theme-toggle");
const prevMonthButton = document.getElementById("prev-month");
const nextMonthButton = document.getElementById("next-month");

// App state
let tasks = [];
let currentFilter = "all";
let calendarDate = new Date();
let selectedCalendarDate = toDateKey(new Date());

function showMessage(text, type = "") {
    message.textContent = text;
    message.className = "message";

    if (type) {
        message.classList.add(type);
    }
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

function showApp(isLoggedIn) {
    authSection.hidden = isLoggedIn;
    appSection.hidden = !isLoggedIn;
}

function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getDeadline(task) {
    if (!task.due_date) return null;

    const time = task.due_time || "23:59";
    const [year, month, day] = task.due_date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);

    return new Date(year, month - 1, day, hours, minutes);
}

function sortTasks() {
    tasks.sort((a, b) => {
        if (Boolean(a.completed) !== Boolean(b.completed)) {
            return a.completed ? 1 : -1;
        }

        const deadlineA = getDeadline(a);
        const deadlineB = getDeadline(b);

        if (!deadlineA && !deadlineB) {
            return Number(b.id) - Number(a.id);
        }

        if (!deadlineA) return 1;
        if (!deadlineB) return -1;

        const difference = deadlineA.getTime() - deadlineB.getTime();

        if (difference !== 0) return difference;

        const order = {
            High: 1,
            Medium: 2,
            Low: 3
        };

        const priorityDifference =
            (order[a.priority] || 2) - (order[b.priority] || 2);

        return priorityDifference || Number(b.id) - Number(a.id);
    });
}

function formatDate(dateString) {
    if (!dateString) return "";

    const [year, month, day] = dateString.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function formatTime(timeString) {
    if (!timeString) return "";

    const [hours, minutes] = timeString.split(":").map(Number);
    const date = new Date();

    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    });
}

function isOverdue(task) {
    return Boolean(
        task.due_date &&
        !task.completed &&
        getDeadline(task) < new Date()
    );
}

async function loadTasks() {
    try {
        const data = await apiRequest("/api/tasks");

        tasks = data.tasks.map(task => ({
            ...task,
            completed: Boolean(task.completed),
            priority: task.priority || "Medium",
            category: task.category || "Personal",
            recurrence: task.recurrence || "None"
        }));

        renderAll();
    } catch (error) {
        showMessage(error.message, "error");
    }
}

function renderAll() {
    renderTasks();
    renderDashboard();
    renderCalendar();
}

function setFilter(filter) {
    currentFilter = filter;

    allBtn.classList.toggle("selected", filter === "all");
    activeBtn.classList.toggle("selected", filter === "active");
    completedBtn.classList.toggle("selected", filter === "completed");

    renderTasks();
}

function createBadge(text, className) {
    const badge = document.createElement("span");

    badge.className = className;
    badge.textContent = text;

    return badge;
}

async function updateTask(task, changes) {
    await apiRequest(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes)
    });

    Object.assign(task, changes);

    if (Object.prototype.hasOwnProperty.call(changes, "dueDate")) {
        task.due_date = changes.dueDate;
        delete task.dueDate;
    }

    if (Object.prototype.hasOwnProperty.call(changes, "dueTime")) {
        task.due_time = changes.dueTime;
        delete task.dueTime;
    }

    if (Object.prototype.hasOwnProperty.call(changes, "recurrence")) {
        task.recurrence = changes.recurrence;
    }

    // Reload so a newly generated recurring task appears immediately.
    await loadTasks();
}

function renderTasks() {
    sortTasks();
    taskList.innerHTML = "";

    const searchTerm = searchInput.value.trim().toLowerCase();

    const filteredTasks = tasks.filter(task => {
        const matchesFilter =
            currentFilter === "all" ||
            (currentFilter === "active" && !task.completed) ||
            (currentFilter === "completed" && task.completed);

        return matchesFilter &&
            task.title.toLowerCase().includes(searchTerm);
    });

    if (filteredTasks.length === 0) {
        const empty = document.createElement("li");

        empty.className = "task-item";
        empty.textContent = searchTerm
            ? "No tasks match your search."
            : "No tasks to display.";

        taskList.appendChild(empty);
        return;
    }

    filteredTasks.forEach(task => {
        const li = document.createElement("li");

        li.className = "task-item";

        if (task.completed) {
            li.classList.add("completed");
        }

        if (isOverdue(task)) {
            li.classList.add("overdue");
        }

        // Complete checkbox
        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", "Complete " + task.title);

        checkbox.addEventListener("change", async () => {
            checkbox.disabled = true;

            try {
                await updateTask(task, {
                    completed: checkbox.checked
                });

                showMessage(
                    task.recurrence !== "None" && checkbox.checked
                        ? "Task completed and next occurrence created!"
                        : "Task updated!",
                    "success"
                );
            } catch (error) {
                checkbox.checked = task.completed;
                showMessage(error.message, "error");
            } finally {
                checkbox.disabled = false;
            }
        });

        // Task title
        const title = document.createElement("span");

        title.className = "task-text";
        title.textContent = task.title;

        // Priority and category badges
        const metadata = document.createElement("div");

        metadata.className = "task-metadata";

        metadata.appendChild(
            createBadge(
                `${task.priority} Priority`,
                `priority-badge priority-${task.priority.toLowerCase()}`
            )
        );

        metadata.appendChild(
            createBadge(task.category, "category-badge")
        );

        if (task.recurrence && task.recurrence !== "None") {
            metadata.appendChild(
                createBadge(
                    `Repeats ${task.recurrence.toLowerCase()}`,
                    "recurrence-badge"
                )
            );
        }

        // Due date and time controls
        const deadline = document.createElement("div");

        deadline.className = "task-deadline";

        const dueLabel = document.createElement("label");

        dueLabel.textContent = "Due:";
        deadline.appendChild(dueLabel);

        const dateInput = document.createElement("input");

        dateInput.type = "date";
        dateInput.className = "task-due-date";
        dateInput.value = task.due_date || "";
        dateInput.setAttribute("aria-label", "Due date for " + task.title);

        const timeInput = document.createElement("input");

        timeInput.type = "time";
        timeInput.className = "task-due-time";
        timeInput.value = task.due_time || "";
        timeInput.setAttribute("aria-label", "Due time for " + task.title);

        if (task.due_date) {
            const dateText = document.createElement("span");

            dateText.textContent =
                `${formatDate(task.due_date)}` +
                `${task.due_time ? " at " + formatTime(task.due_time) : ""}`;

            deadline.appendChild(dateText);
        }

        dateInput.addEventListener("change", async () => {
            const oldDate = task.due_date || "";
            const oldTime = task.due_time || "";

            if (!dateInput.value) {
                timeInput.value = "";
            }

            try {
                await updateTask(task, {
                    dueDate: dateInput.value || null,
                    ...(!dateInput.value
                        ? {
                            dueTime: null,
                            recurrence: "None"
                        }
                        : {})
                });

                showMessage("Due date updated!", "success");
            } catch (error) {
                dateInput.value = oldDate;
                timeInput.value = oldTime;

                showMessage(error.message, "error");
            }
        });

        timeInput.addEventListener("change", async () => {
            const oldTime = task.due_time || "";

            if (timeInput.value && !task.due_date) {
                showMessage(
                    "Select a due date before selecting a time.",
                    "error"
                );

                timeInput.value = "";
                return;
            }

            try {
                await updateTask(task, {
                    dueTime: timeInput.value || null
                });

                showMessage("Due time updated!", "success");
            } catch (error) {
                timeInput.value = oldTime;
                showMessage(error.message, "error");
            }
        });

        deadline.appendChild(dateInput);
        deadline.appendChild(timeInput);

        if (isOverdue(task)) {
            deadline.appendChild(
                createBadge("Overdue", "overdue-label")
            );
        }

        // Priority, category, and recurrence controls
        const controls = document.createElement("div");

        controls.className = "task-edit-controls";

        // Priority dropdown
        const prioritySelect = document.createElement("select");

        ["High", "Medium", "Low"].forEach(value => {
            const option = document.createElement("option");

            option.value = value;
            option.textContent = `${value} Priority`;

            prioritySelect.appendChild(option);
        });

        prioritySelect.value = task.priority;

        prioritySelect.setAttribute(
            "aria-label",
            "Priority for " + task.title
        );

        prioritySelect.addEventListener("change", async () => {
            const previous = task.priority;

            try {
                await updateTask(task, {
                    priority: prioritySelect.value
                });

                showMessage("Priority updated!", "success");
            } catch (error) {
                prioritySelect.value = previous;
                showMessage(error.message, "error");
            }
        });

        // Category dropdown
        const categorySelect = document.createElement("select");

        [
            "School",
            "Work",
            "Personal",
            "Shopping",
            "Health",
            "Finance",
            "Other"
        ].forEach(value => {
            const option = document.createElement("option");

            option.value = value;
            option.textContent = value;

            categorySelect.appendChild(option);
        });

        categorySelect.value = task.category;

        categorySelect.setAttribute(
            "aria-label",
            "Category for " + task.title
        );

        categorySelect.addEventListener("change", async () => {
            const previous = task.category;

            try {
                await updateTask(task, {
                    category: categorySelect.value
                });

                showMessage("Category updated!", "success");
            } catch (error) {
                categorySelect.value = previous;
                showMessage(error.message, "error");
            }
        });

        // Recurrence dropdown
        const recurrenceSelect = document.createElement("select");

        ["None", "Daily", "Weekly", "Monthly"].forEach(value => {
            const option = document.createElement("option");

            option.value = value;

            option.textContent = value === "None"
                ? "Does not repeat"
                : `Repeat ${value.toLowerCase()}`;

            recurrenceSelect.appendChild(option);
        });

        recurrenceSelect.value = task.recurrence || "None";

        recurrenceSelect.setAttribute(
            "aria-label",
            "Repeat setting for " + task.title
        );

        recurrenceSelect.addEventListener("change", async () => {
            const previous = task.recurrence || "None";

            if (recurrenceSelect.value !== "None" && !task.due_date) {
                showMessage(
                    "Add a due date before setting a task to repeat.",
                    "error"
                );

                recurrenceSelect.value = previous;
                return;
            }

            try {
                await updateTask(task, {
                    recurrence: recurrenceSelect.value
                });

                showMessage("Repeat setting updated!", "success");
            } catch (error) {
                recurrenceSelect.value = previous;
                showMessage(error.message, "error");
            }
        });

        controls.append(
            prioritySelect,
            categorySelect,
            recurrenceSelect
        );

        // Delete button
        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-btn";

        deleteButton.setAttribute(
            "aria-label",
            "Delete " + task.title
        );

        deleteButton.addEventListener("click", async () => {
            try {
                await apiRequest(`/api/tasks/${task.id}`, {
                    method: "DELETE"
                });

                tasks = tasks.filter(item => item.id !== task.id);

                renderAll();

                showMessage("Task deleted successfully!", "success");
            } catch (error) {
                showMessage(error.message, "error");
            }
        });

        li.append(
            checkbox,
            title,
            metadata,
            deadline,
            controls,
            deleteButton
        );

        taskList.appendChild(li);
    });
}

// Productivity dashboard
function renderDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const active = total - completed;
    const overdue = tasks.filter(isOverdue).length;

    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    totalCount.textContent = total;
    completedCount.textContent = completed;
    activeCount.textContent = active;
    overdueCount.textContent = overdue;

    progressBar.style.width = `${percentage}%`;
    progressLabel.textContent = `${percentage}% completed`;
}

// Calendar
function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    calendarMonth.textContent = calendarDate.toLocaleDateString(
        "en-US",
        {
            month: "long",
            year: "numeric"
        }
    );

    calendarGrid.innerHTML = "";

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const previousMonthDays = new Date(year, month, 0).getDate();
    const todayKey = toDateKey(new Date());

    for (let cell = 0; cell < 42; cell++) {
        let day;
        let cellDate;
        let outside = false;

        if (cell < firstDay) {
            day = previousMonthDays - firstDay + cell + 1;
            cellDate = new Date(year, month - 1, day);
            outside = true;
        } else if (cell >= firstDay + daysInMonth) {
            day = cell - firstDay - daysInMonth + 1;
            cellDate = new Date(year, month + 1, day);
            outside = true;
        } else {
            day = cell - firstDay + 1;
            cellDate = new Date(year, month, day);
        }

        const key = toDateKey(cellDate);

        const dayTasks = tasks.filter(
            task => task.due_date === key
        );

        const button = document.createElement("button");

        button.type = "button";
        button.className = "calendar-day";

        if (outside) {
            button.classList.add("outside-month");
        }

        if (key === todayKey) {
            button.classList.add("today");
        }

        if (key === selectedCalendarDate) {
            button.classList.add("selected");
        }

        const number = document.createElement("span");

        number.className = "day-number";
        number.textContent = day;

        button.appendChild(number);

        if (dayTasks.length) {
            const count = document.createElement("span");

            count.className = "day-count";

            count.textContent =
                `${dayTasks.length} task${dayTasks.length === 1 ? "" : "s"}`;

            button.appendChild(count);
        }

        button.addEventListener("click", () => {
            selectedCalendarDate = key;

            if (outside) {
                calendarDate = new Date(
                    cellDate.getFullYear(),
                    cellDate.getMonth(),
                    1
                );
            }

            renderCalendar();
        });

        calendarGrid.appendChild(button);
    }

    calendarSelection.textContent =
        `Tasks for ${formatDate(selectedCalendarDate)}`;

    calendarTaskList.innerHTML = "";

    const selectedTasks = tasks.filter(
        task => task.due_date === selectedCalendarDate
    );

    if (selectedTasks.length === 0) {
        const empty = document.createElement("li");

        empty.textContent = "No tasks due on this date.";

        calendarTaskList.appendChild(empty);
    } else {
        selectedTasks.forEach(task => {
            const item = document.createElement("li");

            item.textContent =
                `${task.completed ? "✓ " : ""}${task.title}` +
                `${task.due_time ? " — " + formatTime(task.due_time) : ""}` +
                ` (${task.priority}, ${task.category})`;

            calendarTaskList.appendChild(item);
        });
    }
}

// Dark mode
function applyTheme(theme) {
    document.body.classList.toggle(
        "dark-mode",
        theme === "dark"
    );

    themeToggle.textContent = theme === "dark"
        ? "☀️ Light mode"
        : "🌙 Dark mode";

    themeToggle.setAttribute(
        "aria-pressed",
        String(theme === "dark")
    );
}

themeToggle.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark-mode")
        ? "light"
        : "dark";

    localStorage.setItem("todo-theme", nextTheme);

    applyTheme(nextTheme);
});

const savedTheme = localStorage.getItem("todo-theme") || "light";

applyTheme(savedTheme);

// Register account
registerForm.addEventListener("submit", async event => {
    event.preventDefault();

    const username = document.getElementById("register-username").value;
    const password = document.getElementById("register-password").value;

    try {
        const data = await apiRequest("/api/register", {
            method: "POST",
            body: JSON.stringify({
                username,
                password
            })
        });

        showMessage(
            data.message + " You can now log in.",
            "success"
        );

        registerForm.reset();
    } catch (error) {
        showMessage(error.message, "error");
    }
});

// Login
loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    try {
        const data = await apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify({
                username,
                password
            })
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

// Logout
logoutButton.addEventListener("click", async () => {
    try {
        const data = await apiRequest("/api/logout", {
            method: "POST"
        });

        tasks = [];
        taskList.innerHTML = "";
        searchInput.value = "";

        showApp(false);

        showMessage(data.message, "success");
    } catch (error) {
        showMessage(error.message, "error");
    }
});

// Add task
taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    const title = taskInput.value.trim();
    const dueDate = dueDateInput.value || null;
    const dueTime = dueTimeInput.value || null;
    const priority = priorityInput.value;
    const category = categoryInput.value;
    const recurrence = recurrenceInput.value;

    if (!title) return;

    if (dueTime && !dueDate) {
        showMessage(
            "Select a due date before selecting a time.",
            "error"
        );

        return;
    }

    if (recurrence !== "None" && !dueDate) {
        showMessage(
            "A due date is required for recurring tasks.",
            "error"
        );

        return;
    }

    try {
        const data = await apiRequest("/api/tasks", {
            method: "POST",
            body: JSON.stringify({
                title,
                dueDate,
                dueTime,
                priority,
                category,
                recurrence
            })
        });

        tasks.push({
            ...data.task,
            completed: Boolean(data.task.completed),
            recurrence: data.task.recurrence || "None"
        });

        taskInput.value = "";
        dueDateInput.value = "";
        dueTimeInput.value = "";
        priorityInput.value = "Medium";
        categoryInput.value = "Personal";
        recurrenceInput.value = "None";

        taskInput.focus();

        renderAll();

        showMessage("Task added successfully!", "success");
    } catch (error) {
        showMessage(error.message, "error");
    }
});

// Search and filters
searchInput.addEventListener("input", renderTasks);

allBtn.addEventListener("click", () => {
    setFilter("all");
});

activeBtn.addEventListener("click", () => {
    setFilter("active");
});

completedBtn.addEventListener("click", () => {
    setFilter("completed");
});

// Calendar navigation
prevMonthButton.addEventListener("click", () => {
    calendarDate = new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth() - 1,
        1
    );

    renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
    calendarDate = new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth() + 1,
        1
    );

    renderCalendar();
});

// Check whether the user is already logged in
async function checkLoginStatus() {
    try {
        const data = await apiRequest("/api/me");

        usernameDisplay.textContent = data.user.username;

        showApp(true);

        await loadTasks();
    } catch {
        showApp(false);
    }
}

// Initial page setup
setFilter("all");
renderCalendar();
checkLoginStatus();