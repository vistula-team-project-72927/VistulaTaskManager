let supabaseUrl;
let supabaseKey;
let tableName;

let tasks = [];
let editingTaskId = null;

const taskForm = document.getElementById("task-form");
const taskTitle = document.getElementById("task-title");
const taskDescription = document.getElementById("task-description");
const taskSubmit = document.getElementById("task-submit");
const taskList = document.getElementById("task-list");
const statusMessage = document.getElementById("status-message");

function showMessage(message) {
    statusMessage.textContent = message;
}

async function initializeApp() {
    try {
        const response = await fetch("./config.json");

        if (!response.ok) {
            throw new Error("Could not load configuration.");
        }

        const config = await response.json();

        supabaseUrl = config.supabaseUrl.replace(/\/+$/, "");
        supabaseKey = config.supabasePublishableKey;
        tableName = config.tableName;

        if (!supabaseKey || tableName !== "tasks") {
            throw new Error("Invalid Supabase configuration.");
        }

        await loadTasks();

    } catch (error) {
        showMessage("Error: " + error.message);
    }
}

async function apiRequest(endpoint, method = "GET", data = null) {
    const options = {
        method: method,
        headers: {
            "apikey": supabaseKey,
            "Authorization": "Bearer " + supabaseKey,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    };

    if (data !== null) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(
        `${supabaseUrl}/rest/v1/${tableName}${endpoint}`,
        options
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Database operation failed.");
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();

    return text ? JSON.parse(text) : null;
}

async function loadTasks() {
    try {
        tasks = await apiRequest("?select=*&order=id.desc");

        displayTasks();

        showMessage("Tasks loaded successfully.");

    } catch (error) {
        showMessage("Could not load tasks: " + error.message);
    }
}

function displayTasks() {
    taskList.replaceChildren();

    if (tasks.length === 0) {
        taskList.textContent = "No tasks yet. Add your first task!";
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "task-item";
        item.dataset.id = task.id;

        if (task.completed) {
            item.classList.add("completed");
        }

        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.title;

        const description = document.createElement("p");
        description.className = "task-description";
        description.textContent = task.description || "No description";

        const status = document.createElement("p");
        status.className = "task-status";
        status.textContent = task.completed ? "Completed" : "Incomplete";

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const editButton = document.createElement("button");
        editButton.className = "edit-task";
        editButton.type = "button";
        editButton.textContent = "Edit";

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-task";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";

        const toggleButton = document.createElement("button");
        toggleButton.className = "toggle-task";
        toggleButton.type = "button";
        toggleButton.textContent = task.completed
            ? "Mark Incomplete"
            : "Mark Complete";

        actions.append(editButton, toggleButton, deleteButton);

        item.append(title, description, status, actions);

        taskList.appendChild(item);
    });
}

taskForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const title = taskTitle.value.trim();
    const description = taskDescription.value.trim();

    if (!title) {
        showMessage("Task title is required.");
        return;
    }

    try {
        if (editingTaskId !== null) {
            await apiRequest(
                `?id=eq.${encodeURIComponent(editingTaskId)}`,
                "PATCH",
                {
                    title: title,
                    description: description
                }
            );

            showMessage("Task updated successfully.");

        } else {
            await apiRequest(
                "",
                "POST",
                {
                    title: title,
                    description: description,
                    completed: false
                }
            );

            showMessage("Task added successfully.");
        }

        editingTaskId = null;
        taskForm.reset();
        taskSubmit.textContent = "Add Task";

        await loadTasks();

    } catch (error) {
        showMessage("Error: " + error.message);
    }
});

taskList.addEventListener("click", async function(event) {
    const button = event.target.closest("button");

    if (!button) {
        return;
    }

    const item = button.closest(".task-item");

    if (!item) {
        return;
    }

    const taskId = item.dataset.id;

    const task = tasks.find(
        t => String(t.id) === String(taskId)
    );

    if (!task) {
        return;
    }

    try {
        if (button.classList.contains("edit-task")) {
            editingTaskId = task.id;

            taskTitle.value = task.title;
            taskDescription.value = task.description || "";

            taskSubmit.textContent = "Save Changes";

            showMessage("Editing task: " + task.title);

            taskTitle.focus();
        }

        else if (button.classList.contains("delete-task")) {
            if (!confirm("Are you sure you want to delete this task?")) {
                return;
            }

            await apiRequest(
                `?id=eq.${encodeURIComponent(taskId)}`,
                "DELETE"
            );

            if (String(editingTaskId) === String(taskId)) {
                editingTaskId = null;
                taskForm.reset();
                taskSubmit.textContent = "Add Task";
            }

            showMessage("Task deleted successfully.");

            await loadTasks();
        }

        else if (button.classList.contains("toggle-task")) {
            await apiRequest(
                `?id=eq.${encodeURIComponent(taskId)}`,
                "PATCH",
                {
                    completed: !task.completed
                }
            );

            showMessage("Task status updated.");

            await loadTasks();
        }

    } catch (error) {
        showMessage("Error: " + error.message);
    }
});

initializeApp();
