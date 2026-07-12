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

type PendingProfile = {
  id: string
  email: string | null
  full_name: string | null
  building_name: string | null
  created_at: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function AdminPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pendingUsers, setPendingUsers] = useState<PendingProfile[]>([])
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

      const { data: pending } = await supabase
        .from("profiles")
        .select("id, email, full_name, building_name, created_at")
        .eq("status", "pending_approval")
        .order("created_at", { ascending: true })

      setPendingUsers(pending || [])
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

    setPendingUsers((prev) => prev.filter((p) => p.id !== profileId))
    toast({ title: "User approved", variant: "success" })
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

    setPendingUsers((prev) => prev.filter((p) => p.id !== profileId))
    setRejectingId(null)
    setRejectReason("")
    toast({ title: "User rejected", variant: "success" })
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin — Pending Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve or reject new user registrations.
        </p>
      </div>

      {pendingUsers.length === 0 ? (
        <p className="text-muted-foreground">No pending approvals.</p>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {pendingUsers.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {user.full_name || "Unknown"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span>{user.email || "—"}</span>
                  <span className="text-muted-foreground">Building</span>
                  <span>{user.building_name || "—"}</span>
                  <span className="text-muted-foreground">Applied</span>
                  <span>{formatDate(user.created_at)}</span>
                </div>

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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
