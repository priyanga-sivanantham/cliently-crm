const mongoose = require('mongoose')
const Customer = require('../../../models/Customer')
const CustomerAccount = require('../../../models/CustomerAccount')
const CustomerSession = require('../../../models/CustomerSession')
const ServiceRequest = require('../../../models/ServiceRequest')
const { inviteOrLink, inviteMessage } = require('../../../utils/portalInvite')
const { OPEN_STATUSES, fail, checkId } = require('../helpers')

async function findCustomer(req) {
  checkId(req.params.id, 'customer')
  const customer = await Customer.findOne({ _id: req.params.id, tenantId: req.user.tenantId }).lean()
  if (!customer) throw fail('Customer not found', 404)
  return customer
}

async function listCustomers(req, res, next) {
  try {
    const tenantId = req.user.tenantId
    const customers = await Customer.find({ tenantId })
      .select('customerCode name phone city status salesExecName createdAt')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
    const ids = customers.map((c) => c._id)

    const [accounts, openCounts] = await Promise.all([
      CustomerAccount.find({ tenantId, customerId: { $in: ids } }).select('customerId loginId status lastLoginAt').lean(),
      ServiceRequest.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(String(tenantId)), customerId: { $in: ids }, status: { $in: OPEN_STATUSES } } },
        { $group: { _id: '$customerId', count: { $sum: 1 } } }
      ])
    ])
    const accountOf = Object.fromEntries(accounts.map((a) => [String(a.customerId), a]))
    const openOf = Object.fromEntries(openCounts.map((o) => [String(o._id), o.count]))

    res.json({
      count: customers.length,
      customers: customers.map((c) => {
        const account = accountOf[String(c._id)]
        return {
          id: c._id,
          customerCode: c.customerCode,
          name: c.name,
          phone: c.phone,
          city: c.city,
          status: c.status,
          salesExecName: c.salesExecName || null,
          openRequests: openOf[String(c._id)] || 0,
          portal: account
            ? { loginId: account.loginId, status: account.status, lastLoginAt: account.lastLoginAt || null }
            : null,
          createdAt: c.createdAt
        }
      })
    })
  } catch (err) {
    next(err)
  }
}

async function setPortalAccess(req, res, next) {
  try {
    const customer = await findCustomer(req)
    if (typeof req.body.enabled !== 'boolean') throw fail('Send { "enabled": true } or { "enabled": false }')

    const account = await CustomerAccount.findOne({ tenantId: customer.tenantId, customerId: customer._id }).select('+passwordHash')
    if (!account) throw fail('This customer has no portal login yet', 404)

    if (!req.body.enabled) {
      if (account.status === 'Disabled') return res.json({ message: 'Portal access is already disabled', portal: { loginId: account.loginId, status: account.status } })
      account.status = 'Disabled'
      account.activationTokenHash = null
      account.activationExpiresAt = null
      await account.save()
      await CustomerSession.updateMany(
        { accountId: account._id, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: 'account_inactive' } }
      )
      return res.json({ message: `Portal access disabled for ${customer.name}`, portal: { loginId: account.loginId, status: account.status } })
    }

    if (account.status !== 'Disabled') {
      return res.json({ message: 'Portal access is already enabled', portal: { loginId: account.loginId, status: account.status } })
    }
    account.status = account.passwordHash ? 'Active' : 'Pending'
    account.failedAttempts = 0
    account.lockedUntil = null
    await account.save()
    res.json({ message: `Portal access enabled for ${customer.name}`, portal: { loginId: account.loginId, status: account.status } })
  } catch (err) {
    next(err)
  }
}

async function newPortalLink(req, res, next) {
  try {
    const customer = await findCustomer(req)
    const invite = await inviteOrLink({ customer, issuedBy: req.user.id })
    res.json({ message: inviteMessage('New portal link created. It works for 48 hours.', invite), ...invite })
  } catch (err) {
    if (err.statusCode === 400) return next(fail(err.message, 400))
    next(err)
  }
}

module.exports = { listCustomers, setPortalAccess, newPortalLink }