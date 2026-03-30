import Link from 'next/link'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const messages: Record<string, string> = {
    CredentialsSignin: 'Email sau parolă incorectă.',
    Configuration: 'Eroare de configurare server.',
    AccessDenied: 'Acces refuzat.',
    Verification: 'Link-ul de verificare a expirat.',
  }

  const message = (error && messages[error]) ?? 'A apărut o eroare la autentificare.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Eroare autentificare</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Înapoi la login
        </Link>
      </div>
    </div>
  )
}
