export default function AccessPendingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold text-primary">Access Pending</h1>
        <p className="text-muted-foreground">
          Your account has been created but is not yet authorised.
          Please wait for an administrator to approve your access.
        </p>
      </div>
    </main>
  )
}
