"use client"
import { useGuestStore } from "@/lib/guest-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function GuestDashboardPage() {
  const { state } = useGuestStore()

  const totalBalance = state.payments
    .filter(p => p.on_dashboard)
    .reduce((s, p) => s + (p.method === 'cash' ? p.amount : 0), 0)
    - state.expenses
    .filter(e => e.paid)
    .reduce((s, e) => s + (e.method === 'cash' ? e.amount : 0), 0)

  const thisMonth = new Date().toISOString().slice(0, 7)
  const collectedThisMonth = state.payments
    .filter(p => p.date_paid.startsWith(thisMonth))
    .reduce((s, p) => s + p.amount, 0)

  const spentThisMonth = state.expenses
    .filter(e => e.date.startsWith(thisMonth) && e.paid)
    .reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demo Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {state.settings.building_name} — {state.apartments.length} apartments
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total balance</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalBalance.toLocaleString()} EGP</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Collected this month</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{collectedThisMonth.toLocaleString()} EGP</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Spent this month</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{spentThisMonth.toLocaleString()} EGP</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Apartments</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{state.apartments.filter(a => a.occupancy_status === 'active').length} / {state.apartments.length}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Apartments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {state.apartments.map(apt => (
                <div key={apt.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{apt.unit_number}</span>
                  <span className="text-muted-foreground">{apt.primary_resident_name || "Vacant"}</span>
                  <Badge variant={apt.occupancy_status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {apt.occupancy_status === 'active' ? 'Active' : apt.occupancy_status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recent payments</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {state.payments.slice(0, 6).map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{p.date_paid}</span>
                  <span className="text-muted-foreground capitalize">{p.method}</span>
                  <span className="font-mono">{p.amount.toLocaleString()} EGP</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
        <CardContent className="pt-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>This is a demo.</strong> Data resets after 10 minutes. Create a free account to save your building data permanently.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
