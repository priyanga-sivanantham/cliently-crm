const Tenant = require('../models/Tenant')
const { issuePortalAccess } = require('./customerAccess')
const { sendMail } = require('./mailer')

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function buildActivationEmail({ customerName, companyName, loginId, activationLink, isReset }) {
  const subject = isReset
    ? `${companyName}: set a new password for your customer account`
    : `${companyName}: activate your customer account`
  const intro = isReset
    ? 'We received a request to set a new password for your customer account.'
    : 'Your customer account is ready. Activate it to see your products and request services online.'

  const text = [
    `Hello ${customerName},`,
    '',
    intro,
    '',
    `Your login ID: ${loginId}`,
    '',
    `${isReset ? 'Set a new password' : 'Activate your account'}: ${activationLink}`,
    '',
    'This link works once and expires in 48 hours.',
    'If you did not expect this email, you can ignore it.',
    '',
    companyName
  ].join('\n')

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f8f7;font-family:Arial,Helvetica,sans-serif;color:#183735">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:12px;padding:32px">
<tr><td style="font-size:20px;font-weight:bold;color:#0f5f59;padding-bottom:16px">${escapeHtml(companyName)}</td></tr>
<tr><td style="font-size:15px;line-height:22px;padding-bottom:8px">Hello ${escapeHtml(customerName)},</td></tr>
<tr><td style="font-size:15px;line-height:22px;padding-bottom:20px">${escapeHtml(intro)}</td></tr>
<tr><td style="padding:14px 16px;background:#ddf6f1;border-radius:8px;font-size:14px">Your login ID<br><strong style="font-size:22px;letter-spacing:2px;font-family:Consolas,monospace">${escapeHtml(loginId)}</strong></td></tr>
<tr><td style="padding:24px 0"><a href="${escapeHtml(activationLink)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">${isReset ? 'Set a new password' : 'Activate account'}</a></td></tr>
<tr><td style="font-size:13px;line-height:20px;color:#637875">This link works once and expires in 48 hours. If the button does not work, copy this address into your browser:<br><span style="word-break:break-all">${escapeHtml(activationLink)}</span></td></tr>
<tr><td style="font-size:13px;color:#637875;padding-top:16px">If you did not expect this email, you can ignore it.</td></tr>
</table></td></tr></table></body></html>`

  return { subject, text, html }
}

async function inviteCustomer({ customer, issuedBy }) {
  const email = String(customer.email || '').trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) {
    const err = new Error('This customer has no valid email address')
    err.statusCode = 400
    throw err
  }

  const [tenant, portal] = await Promise.all([
    Tenant.findById(customer.tenantId).select('companyName').lean(),
    issuePortalAccess({ tenantId: customer.tenantId, customerId: customer._id, issuedBy })
  ])

  const message = buildActivationEmail({
    customerName: customer.name,
    companyName: tenant?.companyName || 'Customer Portal',
    loginId: portal.loginId,
    activationLink: portal.activationLink,
    isReset: portal.status === 'Active'
  })

  let emailResult = { sent: false, to: email, previewUrl: null, error: null }
  try {
    const result = await sendMail({ to: email, ...message })
    emailResult = { sent: true, to: email, previewUrl: result.previewUrl, error: null }
  } catch (err) {
    console.error('Activation email failed:', err.message)
    emailResult.error = 'The email could not be sent. Try again later.'
  }

  const showLink = process.env.NODE_ENV !== 'production'
  return {
    portal: {
      loginId: portal.loginId,
      status: portal.status,
      expiresAt: portal.expiresAt,
      ...(showLink ? { activationLink: portal.activationLink } : {})
    },
    email: emailResult
  }
}

async function inviteOrLink({ customer, issuedBy }) {
  if (EMAIL_PATTERN.test(String(customer.email || '').trim())) {
    return inviteCustomer({ customer, issuedBy })
  }
  const portal = await issuePortalAccess({ tenantId: customer.tenantId, customerId: customer._id, issuedBy })
  return {
    portal,
    email: { sent: false, to: null, previewUrl: null, error: 'No email address on file. Share the link with the customer yourself.' }
  }
}

function inviteMessage(prefix, invite) {
  if (invite.email.sent) return `${prefix} Login email sent to ${invite.email.to}.`
  return `${prefix} ${invite.email.error}`
}

module.exports = { inviteCustomer, inviteOrLink, inviteMessage, EMAIL_PATTERN }