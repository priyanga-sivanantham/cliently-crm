const nodemailer = require('nodemailer')

let transporterPromise = null

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

async function createTransporter() {
  if (smtpConfigured()) {
    const port = Number(process.env.SMTP_PORT) || 465
    return {
      mode: 'smtp',
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      })
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Email is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASS')
  }

  const account = await nodemailer.createTestAccount()
  console.log('Email: no SMTP settings found, using an Ethereal test inbox (emails are not delivered)')
  return {
    mode: 'test',
    from: process.env.MAIL_FROM || `Cliently Test <${account.user}>`,
    transporter: nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass }
    })
  }
}

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = createTransporter().catch((err) => {
      transporterPromise = null
      throw err
    })
  }
  return transporterPromise
}

async function sendMail({ to, subject, text, html }) {
  const { mode, from, transporter } = await getTransporter()
  const info = await transporter.sendMail({ from, to, subject, text, html })
  const previewUrl = mode === 'test' ? nodemailer.getTestMessageUrl(info) || null : null
  if (previewUrl) console.log(`Email to ${to}: ${subject}\nPreview: ${previewUrl}`)
  return { mode, messageId: info.messageId, previewUrl }
}

module.exports = { sendMail, smtpConfigured }