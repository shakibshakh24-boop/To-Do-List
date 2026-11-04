
// Select HTML elements
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");

// Select filter buttons
const allBtn = document.getElementById("all-btn");
const activeBtn = document.getElementById("active-btn");
const completedBtn = document.getElementById("completed-btn");

// Load saved tasks
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

// Current filter
let currentFilter = "all";

// Save tasks to local storage
function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

// Change the selected filter
function setFilter(filter) {
    currentFilter = filter;

    // Highlight selected button
    allBtn.classList.toggle("selected", filter === "all");
    activeBtn.classList.toggle("selected", filter === "active");
    completedBtn.classList.toggle("selected", filter === "completed");

    renderTasks();
}

// Display tasks
function renderTasks() {

    // Clear the current list
    taskList.innerHTML = "";

    // Filter tasks based on selected category
    const filteredTasks = tasks.filter(function(task) {

        if (currentFilter === "active") {
            return !task.completed;
        }

        if (currentFilter === "completed") {
            return task.completed;
        }

        return true;
    });

    // Loop through filtered tasks
    filteredTasks.forEach(function(task) {

        // Create list item
        const li = document.createElement("li");
        li.classList.add("task-item");

        if (task.completed) {
            li.classList.add("completed");
        }

        // Create checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", "Complete " + task.text);

        // Mark task as completed
        checkbox.addEventListener("change", function() {
            task.completed = checkbox.checked;

            saveTasks();
            renderTasks();
        });

        // Create task text
        const span = document.createElement("span");
        span.classList.add("task-text");
        span.textContent = task.text;

        // Create delete button
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.classList.add("delete-btn");
        deleteButton.setAttribute("aria-label", "Delete " + task.text);

        // Delete task
        deleteButton.addEventListener("click", function() {

            tasks = tasks.filter(function(item) {
                return item.id !== task.id;
            });

            saveTasks();
            renderTasks();
        });

        // Add elements to list item
        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteButton);

        // Add list item to task list
        taskList.appendChild(li);
    });
}

// Add a new task
taskForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const taskText = taskInput.value.trim();

    // Prevent empty tasks
    if (taskText === "") {
        return;
    }

    // Create task object
    const newTask = {
        id: crypto.randomUUID(),
        text: taskText,
        completed: false
    };

    // Add task to array
    tasks.push(newTask);

    saveTasks();
    renderTasks();

    // Clear input
    taskInput.value = "";
    taskInput.focus();
});

// Filter button events
allBtn.addEventListener("click", function() {
    setFilter("all");
});

activeBtn.addEventListener("click", function() {
    setFilter("active");
});

completedBtn.addEventListener("click", function() {
    setFilter("completed");
});

// Display tasks when website loads
setFilter("all");
