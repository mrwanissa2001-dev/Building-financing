"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type UserProfile = {
  id: string
  email: string | null
  full_name: string | null
  building_name: string | null
  status: string
  is_admin: boolean
  created_at: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const statusColors: Record<string, string> = {
  pending_approval: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "pending_approval" ? "Pending" : status === "approved" ? "Approved" : status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusColors[status] || "bg-muted text-muted-foreground")}>
      {label}
    </span>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [tab, setTab] = useState<"pending" | "all">("pending")
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  useEffect(() => {
    async function init() {
      if (!supabase) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace("/auth/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single()

      if (!profile || !profile.is_admin) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      setCurrentUserId(session.user.id)

      const { data: allUsers } = await supabase
        .from("profiles")
        .select("id, email, full_name, building_name, status, is_admin, created_at")
        .order("created_at", { ascending: true })

      setUsers(allUsers || [])
      setLoading(false)
    }

    init()
  }, [router])

  async function handleApprove(profileId: string) {
    if (!supabase || !currentUserId) return

    const { error } = await supabase
      .from("profiles")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: currentUserId,
      })
      .eq("id", profileId)

    if (error) {
      toast({ title: "Failed to approve", description: error.message, variant: "destructive" })
      return
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === profileId ? { ...u, status: "approved" } : u))
    )
    toast({ title: "User approved — they can now sign in" })
  }

  async function handleReject(profileId: string) {
    if (!supabase || !rejectReason.trim()) return

    const { error } = await supabase
      .from("profiles")
      .update({
        status: "rejected",
        rejected_reason: rejectReason.trim(),
      })
      .eq("id", profileId)

    if (error) {
      toast({ title: "Failed to reject", description: error.message, variant: "destructive" })
      return
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === profileId ? { ...u, status: "rejected" } : u))
    )
    setRejectingId(null)
    setRejectReason("")
    toast({ title: "User rejected" })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    )
  }

  const pendingUsers = users.filter((u) => u.status === "pending_approval")
  const pendingCount = pendingUsers.length
  const displayUsers = tab === "pending" ? pendingUsers : users

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">
          Manage user registrations and access.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("pending")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "pending" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Pending {pendingCount > 0 && `(${pendingCount})`}
        </button>
        <button
          onClick={() => setTab("all")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          All Users ({users.length})
        </button>
      </div>

      {displayUsers.length === 0 ? (
        <p className="text-muted-foreground">
          {tab === "pending" ? "No pending approvals." : "No users found."}
        </p>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {displayUsers.map((user) => (
            <Card key={user.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {user.full_name || "Unknown"}
                    {user.is_admin && (
                      <span className="ml-2 text-xs font-normal text-primary">(Admin)</span>
                    )}
                  </CardTitle>
                  <StatusBadge status={user.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span>{user.email || "—"}</span>
                  <span className="text-muted-foreground">Building</span>
                  <span>{user.building_name || "—"}</span>
                  <span className="text-muted-foreground">Registered</span>
                  <span>{formatDate(user.created_at)}</span>
                </div>

                {user.status === "pending_approval" && (
                  <>
                    {rejectingId === user.id ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="Rejection reason…"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleReject(user.id)
                          }}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReject(user.id)}
                            disabled={!rejectReason.trim()}
                          >
                            Confirm Reject
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRejectingId(null)
                              setRejectReason("")
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApprove(user.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setRejectingId(user.id)
                            setRejectReason("")
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
