const Customer = require('../../../models/Customer')
const CustomerAccount = require('../../../models/CustomerAccount')
const CustomerSession = require('../../../models/CustomerSession')
const Tenant = require('../../../models/Tenant')
const { checkPasswordRules, hashPassword, verifyPassword } = require('../../../utils/password')
const service = require('../services/customerSessionService')

const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : undefined
}

async function updateProfile(req, res, next) {
  try {
    const { tenantId, customerId, accountId } = req.customer
    const updates = {}

    const phone = text(req.body.phone, 20)
    if (phone !== undefined) {
      if (!PHONE_PATTERN.test(phone)) throw service.fail('Enter a valid phone number', 400, 'BAD_PHONE')
      updates.phone = phone
    }

    const address = text(req.body.address, 300)
    if (address !== undefined) {
      if (!address) throw service.fail('Address cannot be empty', 400, 'BAD_ADDRESS')
      updates.address = address
    }

    const city = text(req.body.city, 80)
    if (city !== undefined) updates.city = city

    if (Object.keys(updates).length === 0) {
      throw service.fail('Send phone, address or city to update', 400, 'NOTHING_TO_UPDATE')
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: customerId, tenantId },
      { $set: updates },
      { returnDocument: 'after' }
    ).lean()

    const [account, tenant] = await Promise.all([
      CustomerAccount.findById(accountId).lean(),
      Tenant.findById(tenantId).lean()
    ])

    res.json({ message: 'Profile updated', customer: service.toProfile(account, customer, tenant) })
  } catch (err) {
    next(err)
  }
}

async function changePassword(req, res, next) {
  try {
    const { accountId, sessionId } = req.customer
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : ''
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : ''

    if (!currentPassword || !newPassword) {
      throw service.fail('Current password and new password are required', 400, 'MISSING_FIELDS')
    }

    const account = await CustomerAccount.findById(accountId).select('+passwordHash')
    if (!account || !(await verifyPassword(currentPassword, account.passwordHash))) {
      throw service.fail('Current password is incorrect', 400, 'WRONG_PASSWORD')
    }

    const rule = checkPasswordRules(newPassword)
    if (rule) throw service.fail(rule, 400, 'WEAK_PASSWORD')
    if (await verifyPassword(newPassword, account.passwordHash)) {
      throw service.fail('New password must be different from the current one', 400, 'SAME_PASSWORD')
    }

    account.passwordHash = await hashPassword(newPassword)
    account.passwordChangedAt = new Date()
    account.failedAttempts = 0
    account.lockedUntil = null
    await account.save()

    await CustomerSession.updateMany(
      { accountId: account._id, _id: { $ne: sessionId }, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'password_changed' } }
    )

    res.json({ message: 'Password changed. You have been signed out on other devices.' })
  } catch (err) {
    next(err)
  }
}

module.exports = { updateProfile, changePassword }