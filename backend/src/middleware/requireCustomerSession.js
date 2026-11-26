const jwt = require('jsonwebtoken')
const CustomerSession = require('../models/CustomerSession')
const { verifyCustomerToken } = require('../utils/customerTokens')
const service = require('../modules/portal/services/customerSessionService')

function readBearerToken(req) {
  const [scheme, token] = (req.get('authorization') || '').split(' ')
  if (scheme !== 'Bearer' || !token) {
    throw service.fail('Please log in.', 401, 'NO_TOKEN')
  }
  return token
}

function decode(token) {
  try {
    return verifyCustomerToken(token)
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw service.fail('Your access token has expired.', 401, 'TOKEN_EXPIRED')
    }
    throw service.fail('Please log in again.', 401, 'INVALID_TOKEN')
  }
}

async function requireCustomerSession(req, res, next) {
  try {
    const payload = decode(readBearerToken(req))
    const session = await CustomerSession.findById(payload.sid)
    if (session && String(session.accountId) !== String(payload.sub)) {
      throw service.fail('Please log in again.', 401, 'INVALID_TOKEN')
    }

    const now = Date.now()
    await service.checkSession(session, now)
    const { account, customer, tenant } = await service.loadAccount(session)
    await service.touchActivity(session, now)

    req.customer = {
      sessionId: session._id,
      accountId: account._id,
      customerId: customer._id,
      tenantId: tenant._id,
      profile: service.toProfile(account, customer, tenant)
    }
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = requireCustomerSession