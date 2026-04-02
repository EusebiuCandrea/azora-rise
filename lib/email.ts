import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = 'AZORA <noreply@azora.ro>'

function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface ReturnEmailData {
  returnId: string
  orderNumber: string
  customerName: string
  customerEmail?: string
  productTitle: string
  variantTitle?: string
  returnType: 'REFUND' | 'EXCHANGE'
  reason: string
  awbNumber?: string
  iban?: string
  ibanHolder?: string
}

function returnTypeLabel(returnType: 'REFUND' | 'EXCHANGE'): string {
  return returnType === 'REFUND' ? 'Ramburs bani' : 'Schimb produs'
}

export async function sendAdminReturnNotification(data: ReturnEmailData): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    console.error('[email] ADMIN_EMAIL env var is not set — admin notification skipped')
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rise.azora.ro'
  const returnUrl = `${appUrl}/returns/${escapeHtml(data.returnId)}`

  const html = `
    <h2>Retur nou înregistrat</h2>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
      <tr><td><strong>Număr comandă:</strong></td><td>${escapeHtml(data.orderNumber)}</td></tr>
      <tr><td><strong>Client:</strong></td><td>${escapeHtml(data.customerName)}</td></tr>
      ${data.customerEmail ? `<tr><td><strong>Email client:</strong></td><td>${escapeHtml(data.customerEmail)}</td></tr>` : ''}
      <tr><td><strong>Produs:</strong></td><td>${escapeHtml(data.productTitle)}${data.variantTitle ? ` — ${escapeHtml(data.variantTitle)}` : ''}</td></tr>
      <tr><td><strong>Tip retur:</strong></td><td>${returnTypeLabel(data.returnType)}</td></tr>
      <tr><td><strong>Motiv:</strong></td><td>${escapeHtml(data.reason)}</td></tr>
      ${data.awbNumber ? `<tr><td><strong>AWB:</strong></td><td>${escapeHtml(data.awbNumber)}</td></tr>` : ''}
      ${data.returnType === 'REFUND' && data.iban ? `<tr><td><strong>IBAN:</strong></td><td>${escapeHtml(data.iban)}</td></tr>` : ''}
      ${data.returnType === 'REFUND' && data.ibanHolder ? `<tr><td><strong>Titular cont:</strong></td><td>${escapeHtml(data.ibanHolder)}</td></tr>` : ''}
    </table>
    <p style="margin-top:16px;">
      <a href="${returnUrl}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
        Vezi returul în Rise
      </a>
    </p>
  `

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: adminEmail,
      subject: `Retur nou ${data.orderNumber} — ${data.customerName}`,
      html,
    })
  } catch (error) {
    console.error('[email] sendAdminReturnNotification failed:', error)
  }
}

export async function sendCustomerReturnConfirmation(data: ReturnEmailData): Promise<void> {
  if (!data.customerEmail) return

  const html = `
    <p>Bună ${escapeHtml(data.customerName)},</p>
    <p>Returul tău a fost înregistrat cu succes. Iată un rezumat al cererii:</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
      <tr><td><strong>Număr comandă:</strong></td><td>${escapeHtml(data.orderNumber)}</td></tr>
      <tr><td><strong>Produs:</strong></td><td>${escapeHtml(data.productTitle)}${data.variantTitle ? ` — ${escapeHtml(data.variantTitle)}` : ''}</td></tr>
      <tr><td><strong>Tip retur:</strong></td><td>${returnTypeLabel(data.returnType)}</td></tr>
      <tr><td><strong>Motiv:</strong></td><td>${escapeHtml(data.reason)}</td></tr>
    </table>
    <p style="margin-top:16px;">
      Vei fi contactat în <strong>2-3 zile lucrătoare</strong> cu detalii despre procesarea returului tău.
    </p>
    <p>Mulțumim că ai ales AZORA!</p>
    <p style="color:#999;font-size:12px;">Echipa AZORA</p>
  `

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: data.customerEmail,
      subject: 'Returul tău a fost înregistrat — AZORA',
      html,
    })
  } catch (error) {
    console.error('[email] sendCustomerReturnConfirmation failed:', error)
  }
}
