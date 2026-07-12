"use client"

import { useState, useMemo } from "react"
import { CheckSquare } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useStore } from "@/lib/store"
import type { TaskPriority } from "@/lib/types"

function todayStr(): string {
  return new Date().toISOString().split("T")[0]
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  low: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
}

export function TaskWidget() {
  const { state, addTask, updateTask, deleteTask } = useStore()
  const today = todayStr()

  // Add-task form state
  const [newTitle, setNewTitle] = useState("")
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium")
  const [newDueDate, setNewDueDate] = useState("")

  const groups = useMemo(() => {
    const overdue: typeof state.tasks = []
    const todayTasks: typeof state.tasks = []
    const upcoming: typeof state.tasks = []
    const done: typeof state.tasks = []
    const noduedate: typeof state.tasks = []

    for (const task of state.tasks) {
      if (task.status === "done") {
        done.push(task)
        continue
      }
      if (task.due_date === null) {
        noduedate.push(task)
      } else if (task.due_date < today) {
        overdue.push(task)
      } else if (task.due_date === today) {
        todayTasks.push(task)
      } else {
        upcoming.push(task)
      }
    }

    return { overdue, today: todayTasks, upcoming, done, noduedate }
  }, [state.tasks, today])

  const incompleteCount = groups.overdue.length + groups.today.length + groups.upcoming.length + groups.noduedate.length

  function toggleDone(taskId: string, currentlyDone: boolean) {
    const task = state.tasks.find((t) => t.id === taskId)
    if (!task) return
    updateTask({ ...task, status: currentlyDone ? "todo" : "done" })
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    addTask({
      title,
      priority: newPriority,
      due_date: newDueDate || null,
      status: "todo",
      description: "",
      color: "sky",
      user_id: "",
    })
    setNewTitle("")
    setNewPriority("medium")
    setNewDueDate("")
  }

  function TaskRow({ task }: { task: (typeof state.tasks)[0] }) {
    const isDone = task.status === "done"
    return (
      <div className="flex items-center gap-2 py-1">
        <input
          type="checkbox"
          checked={isDone}
          onChange={() => toggleDone(task.id, isDone)}
          className="h-4 w-4 shrink-0 rounded border-border accent-primary"
        />
        <span className={`min-w-0 flex-1 truncate text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[task.priority]}`}>
          {task.priority}
        </span>
        {task.due_date && !isDone && (
          <span className="shrink-0 text-[10px] text-muted-foreground">{task.due_date}</span>
        )}
      </div>
    )
  }

  function GroupSection({
    label,
    tasks,
    labelClass,
  }: {
    label: string
    tasks: typeof state.tasks
    labelClass: string
  }) {
    if (tasks.length === 0) return null
    return (
      <div className="mt-3 first:mt-0">
        <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${labelClass}`}>
          {label} <span className="ml-1 opacity-70">({tasks.length})</span>
        </p>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
    )
  }

  const hasAnyTask = state.tasks.length > 0

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold tracking-tight">Tasks</h2>
        </div>
        {incompleteCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {incompleteCount}
          </Badge>
        )}
      </div>

      {/* Task groups */}
      {!hasAnyTask ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet</p>
      ) : (
        <div className="max-h-80 overflow-y-auto pr-1">
          <GroupSection
            label="Overdue"
            tasks={groups.overdue}
            labelClass="text-red-600 dark:text-red-400"
          />
          <GroupSection
            label="Today"
            tasks={groups.today}
            labelClass="text-amber-600 dark:text-amber-400"
          />
          <GroupSection
            label="Upcoming"
            tasks={groups.upcoming}
            labelClass="text-green-600 dark:text-green-400"
          />
          <GroupSection
            label="No due date"
            tasks={groups.noduedate}
            labelClass="text-muted-foreground"
          />

          {/* Done section */}
          {groups.done.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Done <span className="ml-1 opacity-70">({groups.done.length})</span>
              </p>
              <div className="opacity-60">
                {groups.done.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add task form */}
      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New task title…"
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
        <select
          value={newPriority}
          onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Add
        </button>
      </form>
    </Card>
  )
}
