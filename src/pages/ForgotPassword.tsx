// components/ForgotPassword.tsx
import React, { useState } from "react"
import { GlassCard } from "@/components/ui/GlassCard"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

// YOUR Supabase project URL — set this once in your .env (recommended)
// Example: https://abcde12345.supabase.co
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://your-project.supabase.co"
const FORGOT_PASSWORD_URL = `${SUPABASE_URL}/functions/v1/forgot-password`

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSubmitted(false)
    setLoading(true)

    if (!email.trim()) {
      setError("Please enter your email address.")
      setLoading(false)
      return
    }

    try {
      const response = await fetch(FORGOT_PASSWORD_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          setError("Too many attempts. Please try again in 15 minutes.")
        } else {
          setError(data.error || "Something went wrong. Please try again.")
        }
        setLoading(false)
        return
      }

      // Always show generic success message — prevents enumeration
      setSubmitted(true)
    } catch (err) {
      console.error("Network error during password reset:", err)
      setError("Unable to connect. Please check your internet connection.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background/90 via-background/85 to-background/80">
      <div className="container mx-auto px-4 sm:px-6 flex items-center justify-center">
        <GlassCard className="w-full max-w-md mx-auto p-8 sm:p-10 md:p-12 glass-strong rounded-2xl sm:rounded-3xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-8 text-center">
            Forgot Password
          </h2>

          {submitted ? (
            <div className="text-center space-y-4">
              <div className="text-green-600 dark:text-green-400 text-base sm:text-lg md:text-xl font-medium">
                Check your email
              </div>
              <p className="text-muted-foreground text-sm sm:text-base">
                If an account exists with that email, a password reset link has been sent.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Check your spam/junk folder if you don’t see it.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="mt-1 block w-full px-4 py-3 border border-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-base bg-background/80 disabled:opacity-60 placeholder:text-muted-foreground/50"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-red-500 dark:text-red-400 text-sm text-center font-medium bg-red-500/10 dark:bg-red-500/20 px-4 py-3 rounded-lg border border-red-500/20">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-4 text-lg rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </form>
          )}

          <div className="mt-8 text-center">
            <a
              href="/login"
              className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              Back to Sign In
            </a>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

export default ForgotPassword