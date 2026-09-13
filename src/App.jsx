// src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase";
import { ref, push, onValue, update, remove } from "firebase/database";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import "./App.css";

const COLUMNS = [
  { id: "todo", title: "To Do", color: "#2563eb" },
  { id: "inProgress", title: "In Progress", color: "#d97706" },
  { id: "done", title: "Done", color: "#16a34a" },
];

function App() {
  // Auth States
  const [user, setUser] = useState(null);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Profile Dropdown State & Ref
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileDropdownRef = useRef(null);

  // Project Delete Modal State
  const [projectToDelete, setProjectToDelete] = useState(null);

  // Navigation & Project Context
  const [currentTab, setCurrentTab] = useState("projects");
  const [activeProject, setActiveProject] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Projects State
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  // Tasks State
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskPoints, setTaskPoints] = useState(3);
  const [dueDate, setDueDate] = useState("");

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Firebase Realtime Listeners
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Listen to Projects
        const projectsRef = ref(db, `users/${currentUser.uid}/projects`);
        onValue(projectsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const list = Object.keys(data).map((key) => ({
              id: key,
              ...data[key],
            }));
            setProjects(list);
          } else {
            setProjects([]);
          }
        });

        // Listen to Tasks
        const tasksRef = ref(db, `users/${currentUser.uid}/tasks`);
        onValue(tasksRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const list = Object.keys(data).map((key) => ({
              id: key,
              ...data[key],
            }));
            setTasks(list);
          } else {
            setTasks([]);
          }
        });
      } else {
        setProjects([]);
        setTasks([]);
        setActiveProject(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Auth Functions
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");

    if (isRegistering && !authName.trim()) {
      setAuthError("Please enter your name.");
      return;
    }

    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        await updateProfile(userCredential.user, {
          displayName: authName.trim(),
        });
        setUser({ ...userCredential.user, displayName: authName.trim() });
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
    } catch (err) {
      switch (err.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          setAuthError("Incorrect email or password. Please try again.");
          break;
        case "auth/email-already-in-use":
          setAuthError("This email is already registered. Please log in instead.");
          break;
        case "auth/weak-password":
          setAuthError("Password is too weak. Please use at least 6 characters.");
          break;
        case "auth/invalid-email":
          setAuthError("Please enter a valid email address.");
          break;
        default:
          setAuthError("An error occurred during authentication. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const confirmLogout = () => {
    signOut(auth);
    setShowLogoutModal(false);
    setShowProfileMenu(false);
  };

  // Add Project Manual
  const handleAddProject = (e) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user) return;

    const projectsRef = ref(db, `users/${user.uid}/projects`);
    push(projectsRef, {
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || "No description provided",
      createdAt: new Date().toLocaleDateString(),
    });

    setNewProjectName("");
    setNewProjectDesc("");
  };

  // Trigger Delete Confirmation Modal
  const requestDeleteProject = (project, e) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setProjectToDelete(project);
  };

  // Confirm and Execute Project Deletion
  const confirmDeleteProject = async () => {
    if (!user || !projectToDelete) return;
    const targetId = projectToDelete.id;

    try {
      await remove(ref(db, `users/${user.uid}/projects/${targetId}`));
      tasks.forEach((t) => {
        if (t.projectId === targetId) {
          remove(ref(db, `users/${user.uid}/tasks/${t.id}`));
        }
      });

      if (activeProject && activeProject.id === targetId) {
        setActiveProject(null);
        setCurrentTab("projects");
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setProjectToDelete(null);
    }
  };

  // Open Project Kanban Board
  const openProjectBoard = (project) => {
    setActiveProject(project);
    setCurrentTab("tasks");
  };

  // Add Task to Active Project
  const handleAddTask = (e) => {
    e.preventDefault();
    if (!taskTitle.trim() || !user || !activeProject) return;

    const userTasksRef = ref(db, `users/${user.uid}/tasks`);
    push(userTasksRef, {
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      projectId: activeProject.id,
      projectName: activeProject.name,
      priority: taskPriority,
      storyPoints: Number(taskPoints),
      dueDate: dueDate || null,
      status: "todo",
      createdAt: new Date().toLocaleDateString(),
    });

    setTaskTitle("");
    setTaskDesc("");
    setDueDate("");
  };

  // Drag & Drop Handler
  const onDragEnd = (result) => {
    const { destination, draggableId } = result;
    if (!destination || !user) return;

    update(ref(db, `users/${user.uid}/tasks/${draggableId}`), {
      status: destination.droppableId,
    });
  };

  const deleteTask = (taskId) => {
    if (!user) return;
    remove(ref(db, `users/${user.uid}/tasks/${taskId}`));
  };

  const isOverdue = (targetDate, status) => {
    if (!targetDate || status === "done") return false;
    const today = new Date().toISOString().split("T")[0];
    return targetDate < today;
  };

  // Filter Tasks for Active Project
  const projectTasks = activeProject
    ? tasks.filter((t) => t.projectId === activeProject.id)
    : tasks;

  const filteredTasks = projectTasks.filter((t) => {
    return (
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  // Metrics
  const totalTasks = projectTasks.length;
  const todoCount = projectTasks.filter((t) => t.status === "todo").length;
  const inProgCount = projectTasks.filter((t) => t.status === "inProgress").length;
  const doneCount = projectTasks.filter((t) => t.status === "done").length;

  const totalPoints = projectTasks.reduce((sum, t) => sum + (Number(t.storyPoints) || 0), 0);
  const donePoints = projectTasks
    .filter((t) => t.status === "done")
    .reduce((sum, t) => sum + (Number(t.storyPoints) || 0), 0);

  const velocityPercent = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;

  // View: Authentication
  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="logo-badge">⚡</span>
            <h2>TaskSprint Platform</h2>
          </div>
          <p className="auth-subtitle">
            {isRegistering ? "Create your workspace account" : "Log in to your workspace"}
          </p>

          {authError && <div className="auth-error">{authError}</div>}

          <form onSubmit={handleAuth} className="auth-form">
            {isRegistering && (
              <input
                type="text"
                placeholder="Full Name"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                required
              />
            )}
            <input
              type="email"
              placeholder="Email address"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password (min 6 chars)"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
            />
            <button type="submit" className="primary-btn full-width" disabled={isLoading}>
              {isLoading ? "Please wait..." : isRegistering ? "Sign Up" : "Log In"}
            </button>
          </form>

          <p className="toggle-auth">
            {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError("");
              }}
            >
              {isRegistering ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Display Name or Fallback
  const displayName = user.displayName || user.email.split("@")[0];
  const avatarLetter = (user.displayName ? user.displayName[0] : user.email[0]).toUpperCase();
  const creationDate = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString()
    : "Recently";

  // View: Workspace
  return (
    <div className="app-layout">
      {/* Logout Warning Modal */}
      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⚠️</div>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to sign out of your TaskSprint workspace?</p>
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setShowLogoutModal(false)}>
                Cancel
              </button>
              <button className="modal-confirm-btn" onClick={confirmLogout}>
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Delete Warning Modal */}
      {projectToDelete && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">🗑️</div>
            <h3>Delete Project?</h3>
            <p>
              Are you sure you want to delete <strong>"{projectToDelete.name}"</strong>?
              This will permanently remove the project and all its sprint tasks.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setProjectToDelete(null)}>
                Cancel
              </button>
              <button className="modal-confirm-btn" onClick={confirmDeleteProject}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand-header">
          <span className="logo-badge">⚡</span>
          <h3>TaskSprint</h3>
        </div>

        <nav className="nav-list">
          <button
            className={`nav-btn ${currentTab === "projects" ? "active" : ""}`}
            onClick={() => setCurrentTab("projects")}
          >
            📁 Projects Hub
          </button>
          <button
            className={`nav-btn ${currentTab === "tasks" ? "active" : ""}`}
            onClick={() => {
              if (!activeProject && projects.length > 0) {
                setActiveProject(projects[0]);
              }
              setCurrentTab("tasks");
            }}
          >
            📋 Sprint Kanban
          </button>
          <button
            className={`nav-btn ${currentTab === "reports" ? "active" : ""}`}
            onClick={() => setCurrentTab("reports")}
          >
            📊 Velocity & Reports
          </button>
        </nav>

        {/* Quick Project Switcher in Sidebar */}
        <div className="sidebar-projects-section">
          <small className="section-label">YOUR PROJECTS</small>
          <div className="project-quick-list">
            {projects.map((p) => (
              <div
                key={p.id}
                className={`quick-project-item ${activeProject?.id === p.id ? "selected" : ""}`}
                onClick={() => openProjectBoard(p)}
              >
                <span>📁 {p.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <button onClick={() => setShowLogoutModal(true)} className="logout-btn">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="content-area">
        <header className="navbar">
          <div className="nav-title-group">
            <h2>
              {currentTab === "projects" && "Projects Hub"}
              {currentTab === "tasks" && (activeProject ? `Kanban: ${activeProject.name}` : "Sprint Kanban")}
              {currentTab === "reports" && "Agile Velocity Analytics"}
            </h2>
            {currentTab === "tasks" && activeProject && (
              <span className="active-proj-desc">{activeProject.description}</span>
            )}
          </div>

          {/* User Info with Clickable Dropdown Trigger */}
          <div className="profile-container" ref={profileDropdownRef}>
            <button
              className="user-info-btn"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              title="Click to view profile"
            >
              <span className="user-badge">{avatarLetter}</span>
              <span className="user-name-text">{displayName}</span>
              <span className="dropdown-caret">▾</span>
            </button>

            {/* Profile Dropdown Popup Menu */}
            {showProfileMenu && (
              <div className="profile-dropdown-card">
                <div className="dropdown-header">
                  <div className="dropdown-avatar">{avatarLetter}</div>
                  <div className="dropdown-user-details">
                    <strong className="dropdown-name">{displayName}</strong>
                    <span className="dropdown-email">{user.email}</span>
                  </div>
                </div>

                <div className="dropdown-divider"></div>

                <div className="dropdown-meta">
                  <div className="dropdown-meta">
                  <div className="meta-row">
                    <span className="meta-label">Joined:</span>
                    <span className="meta-value">{creationDate}</span>
                  </div>
                  
                </div>
                  <div className="meta-row">
                    <span className="meta-label">Active Projects:</span>
                    <span className="meta-value">{projects.length}</span>
                  </div>
                </div>

                <div className="dropdown-divider"></div>

                <button
                  className="dropdown-logout-action"
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowLogoutModal(true);
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* VIEW 1: PROJECTS HUB */}
        {currentTab === "projects" && (
          <main className="main-content">
            <div className="create-project-card">
              <h3>Create New Project</h3>
              <form onSubmit={handleAddProject} className="add-project-form">
                <input
                  type="text"
                  placeholder="Project Name (e.g. Mobile App Redesign)"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Short Description / Scope"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                />
                <button type="submit" className="primary-btn">+ Create Project</button>
              </form>
            </div>

            <h3 className="section-heading">Active Projects ({projects.length})</h3>
            {projects.length === 0 ? (
              <div className="empty-project-prompt">
                <p>No active projects found. Use the form above to add a project.</p>
              </div>
            ) : (
              <div className="projects-grid">
                {projects.map((proj) => {
                  const projTasks = tasks.filter((t) => t.projectId === proj.id);
                  const pDoneCount = projTasks.filter((t) => t.status === "done").length;
                  const percent = projTasks.length > 0 ? Math.round((pDoneCount / projTasks.length) * 100) : 0;

                  return (
                    <div
                      key={proj.id}
                      className="project-tile-card"
                      onClick={() => openProjectBoard(proj)}
                    >
                      <div className="proj-tile-top">
                        <h4>📁 {proj.name}</h4>
                        <button
                          type="button"
                          className="btn-tile-del"
                          title="Delete Project"
                          onClick={(e) => requestDeleteProject(proj, e)}
                        >
                          ✕
                        </button>
                      </div>
                      <p className="proj-tile-desc">{proj.description}</p>

                      <div className="proj-tile-progress">
                        <div className="proj-progress-info">
                          <span>{projTasks.length} Tasks ({pDoneCount} Done)</span>
                          <strong>{percent}%</strong>
                        </div>
                        <div className="progress-track-small">
                          <div className="progress-bar-small" style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>

                      <div className="proj-tile-footer">
                        <span className="open-board-badge">Open Kanban Board ➔</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        )}

        {/* VIEW 2: KANBAN BOARD */}
        {currentTab === "tasks" && (
          <main className="main-content">
            {!activeProject ? (
              <div className="empty-project-prompt">
                <h3>No Project Selected</h3>
                <p>Please select a project from the Projects Hub to view its Sprint Kanban.</p>
                <button className="primary-btn" onClick={() => setCurrentTab("projects")}>
                  Go to Projects Hub
                </button>
              </div>
            ) : (
              <>
                <div className="summary-boxes">
                  <div className="stat-card todo-box">
                    <h4>To Do</h4>
                    <span>{todoCount}</span>
                  </div>
                  <div className="stat-card prog-box">
                    <h4>In Progress</h4>
                    <span>{inProgCount}</span>
                  </div>
                  <div className="stat-card done-box">
                    <h4>Done</h4>
                    <span>{doneCount}</span>
                  </div>
                </div>

                <div className="filter-toolbar">
                  <input
                    type="text"
                    placeholder="🔍 Search tasks in this project..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                  <div className="filter-group">
                    <label>Switch Project:</label>
                    <select
                      value={activeProject.id}
                      onChange={(e) => {
                        const selected = projects.find((p) => p.id === e.target.value);
                        if (selected) setActiveProject(selected);
                      }}
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <form onSubmit={handleAddTask} className="add-task-bar">
                  <input
                    type="text"
                    placeholder={`Task title for ${activeProject.name}`}
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    required
                    className="input-title"
                  />
                  <input
                    type="text"
                    placeholder="Task details"
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    className="input-desc"
                  />
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                  </select>
                  <select
                    value={taskPoints}
                    onChange={(e) => setTaskPoints(e.target.value)}
                    title="Agile Story Points"
                  >
                    <option value={1}>1 pt</option>
                    <option value={2}>2 pts</option>
                    <option value={3}>3 pts</option>
                    <option value={5}>5 pts</option>
                    <option value={8}>8 pts</option>
                  </select>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="input-date"
                    title="Due Date"
                  />
                  <button type="submit" className="primary-btn">+ Add Task</button>
                </form>

                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="board-grid">
                    {COLUMNS.map((col) => {
                      const colTasks = filteredTasks.filter((t) => t.status === col.id);
                      return (
                        <div key={col.id} className="board-column">
                          <div className="column-head" style={{ borderTopColor: col.color }}>
                            <h3>{col.title}</h3>
                            <span className="count-pill">{colTasks.length}</span>
                          </div>

                          <Droppable droppableId={col.id}>
                            {(provided, snapshot) => (
                              <div
                                className={`column-drop-zone ${
                                  snapshot.isDraggingOver ? "drop-active" : ""
                                }`}
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                              >
                                {colTasks.map((item, index) => {
                                  const overdue = isOverdue(item.dueDate, item.status);
                                  return (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                      {(provided) => (
                                        <div
                                          className={`task-card prio-${item.priority.toLowerCase()}`}
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                        >
                                          <div className="task-card-header">
                                            <h4>{item.title}</h4>
                                            <button
                                              className="btn-del"
                                              onClick={() => deleteTask(item.id)}
                                            >
                                              ✕
                                            </button>
                                          </div>
                                          {item.description && (
                                            <p className="task-card-desc">{item.description}</p>
                                          )}

                                          <div className="task-pill-row">
                                            <span className="story-point-badge">
                                              🎯 {item.storyPoints || 1} pt
                                            </span>
                                          </div>

                                          <div className="task-card-footer">
                                            <span className="badge-prio">{item.priority}</span>
                                            {item.dueDate && (
                                              <span
                                                className={`date-badge ${overdue ? "overdue" : ""}`}
                                              >
                                                📅 {item.dueDate} {overdue && "(Overdue)"}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                })}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      );
                    })}
                  </div>
                </DragDropContext>
              </>
            )}
          </main>
        )}

        {/* VIEW 3: REPORTS */}
        {currentTab === "reports" && (
          <main className="main-content">
            <div className="panel-card">
              <h3>
                Agile Sprint Velocity Meter {activeProject && `(${activeProject.name})`}
              </h3>
              <p>Real-time completion based on Story Points estimation</p>

              <div className="report-metric">
                <span>Velocity Completion: {donePoints} / {totalPoints} Points</span>
                <strong>{velocityPercent}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${velocityPercent}%` }}></div>
              </div>

              <div className="report-grid">
                <div className="report-item">
                  <small>Active Project Tasks</small>
                  <h4>{totalTasks}</h4>
                </div>
                <div className="report-item">
                  <small>In Development</small>
                  <h4>{inProgCount}</h4>
                </div>
                <div className="report-item">
                  <small>Completed (DoD Met)</small>
                  <h4>{doneCount}</h4>
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

export default App;