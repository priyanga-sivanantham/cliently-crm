const ServiceRequest = require('../../../models/ServiceRequest')
const { fail, checkId, text, addUpdate, formatRequest } = require('../helpers')

async function setCharge(req, filter) {
  checkId(req.params.id, 'request')
  const amount = Number(req.body.amount)
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
    throw fail('Amount must be between 0 and 1000000')
  }
  const rounded = Math.round(amount * 100) / 100
  if (rounded > 0 && rounded < 1) throw fail('Amount must be at least 1, or 0 for free')

  const request = await ServiceRequest.findOne({ ...filter, _id: req.params.id, tenantId: req.user.tenantId })
  if (!request) throw fail('Service request not found', 404)
  if (request.status === 'Cancelled') throw fail('A cancelled request cannot be charged')
  if (request.paymentStatus === 'Paid') throw fail('This request is already paid')

  request.charge = rounded
  request.paymentStatus = rounded > 0 ? 'Unpaid' : 'Not Required'
  const note = text(req.body.note, 300)
  addUpdate(request, request.status, note || (rounded > 0 ? `Service charge set: Rs ${rounded}` : 'No charge for this service'), req)
  await request.save()

  return formatRequest(request)
}

async function salesSetCharge(req, res, next) {
  try {
    const request = await setCharge(req, { salesExecId: req.user.id })
    res.json({ message: 'Charge updated', serviceRequest: request })
  } catch (err) {
    next(err)
  }
}

async function managerSetCharge(req, res, next) {
  try {
    const request = await setCharge(req, {})
    res.json({ message: 'Charge updated', serviceRequest: request })
  } catch (err) {
    next(err)
  }
}

module.exports = { salesSetCharge, managerSetCharge }