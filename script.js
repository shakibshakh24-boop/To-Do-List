
// Find the HTML elements
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");

// Listen for the form being submitted
taskForm.addEventListener("submit", function(event) {
    event.preventDefault();

    // Get the task the user typed
    const taskText = taskInput.value.trim();

    // Don't allow empty tasks
    if (taskText === "") {
        return;
    }

    // Create a new list item
    const newTask = document.createElement("li");

    // Add the CSS class
    newTask.classList.add("task-item");

    // Set the task text
    newTask.textContent = taskText;

    // Add the task to the list
    taskList.appendChild(newTask);

    // Clear the input field
    taskInput.value = "";
});
