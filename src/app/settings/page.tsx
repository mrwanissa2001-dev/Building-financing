"use client"

import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/ui/use-toast"
import { testConnection } from "@/lib/supabase-data"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

export default function SettingsPage() {
  const { state, updateSettings } = useStore()
  const { toast } = useToast()

  const [totalApartments, setTotalApartments] = useState("")
  const [expectedIncome, setExpectedIncome] = useState("")
  const [expectedExpenditure, setExpectedExpenditure] = useState("")

  const [connStatus, setConnStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [connMessage, setConnMessage] = useState('')

  useEffect(() => {
    testConnection().then(({ ok, message }) => {
      setConnStatus(ok ? 'connected' : 'error')
      setConnMessage(message)
    })
  }, [])

  useEffect(() => {
    if (state.loaded) {
      setTotalApartments(state.settings.total_apartments.toString())
      setExpectedIncome(state.settings.expected_yearly_income.toString())
      setExpectedExpenditure(
        state.settings.expected_yearly_expenditure.toString()
      )
    }
  }, [state.loaded, state.settings])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsedApartments = parseInt(totalApartments, 10)
    const parsedIncome = parseFloat(expectedIncome)
    const parsedExpenditure = parseFloat(expectedExpenditure)

    if (isNaN(parsedApartments) || isNaN(parsedIncome) || isNaN(parsedExpenditure)) {
      return
    }

    updateSettings({
      total_apartments: parsedApartments,
      expected_yearly_income: parsedIncome,
      expected_yearly_expenditure: parsedExpenditure,
    })

    toast({
      title: "Settings saved!",
      description: "Your building settings have been updated.",
      variant: "success",
    })
  }

  if (!state.loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Building Setup</h1>
        <p className="text-sm text-muted-foreground">
          Configure your building&apos;s baseline settings
        </p>
      </div>

      {/* Supabase connection status */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span
              className={
                connStatus === 'connected'
                  ? 'h-2.5 w-2.5 rounded-full bg-green-500 inline-block'
                  : connStatus === 'error'
                  ? 'h-2.5 w-2.5 rounded-full bg-red-500 inline-block'
                  : 'h-2.5 w-2.5 rounded-full bg-yellow-400 inline-block'
              }
            />
            Supabase Connection
          </CardTitle>
          <CardDescription>
            {connStatus === 'checking' && 'Checking connection…'}
            {connStatus === 'connected' && 'Connected — data is being saved to Supabase.'}
            {connStatus === 'error' && (
              <span className="text-red-600 dark:text-red-400">
                Not connected: {connMessage}
                <br />
                Add <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your Vercel environment variables and redeploy.
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Building Settings</CardTitle>
            <CardDescription>
              Set the basic parameters for your building to enable accurate
              financial tracking and reporting.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="total-apartments">Total Apartments</Label>
              <Input
                id="total-apartments"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 12"
                value={totalApartments}
                onChange={(e) => setTotalApartments(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The total number of apartments in the building.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected-income">
                Expected Yearly Income ($)
              </Label>
              <Input
                id="expected-income"
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 30000"
                value={expectedIncome}
                onChange={(e) => setExpectedIncome(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The total income you expect to collect from all apartments per
                year.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected-expenditure">
                Expected Yearly Expenditure ($)
              </Label>
              <Input
                id="expected-expenditure"
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 24000"
                value={expectedExpenditure}
                onChange={(e) => setExpectedExpenditure(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The total amount you expect to spend on building expenses per
                year.
              </p>
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit">Save Settings</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
