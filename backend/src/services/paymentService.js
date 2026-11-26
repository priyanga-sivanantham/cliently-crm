const crypto = require('crypto')
const Payment = require('../models/Payment')
const ServiceRequest = require('../models/ServiceRequest')
const AppError = require('../utils/AppError')

const REUSE_PENDING_MS = 15 * 60 * 1000

function fail(message, status, code) {
  const err = new AppError(message, status, code)
  err.code = code
  return err
}

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw fail('Online payment is not available right now. Please try again later.', 503, 'PAYMENTS_DISABLED')
  }
  return require('../config/razorpay')
}

function safeEqualHex(expectedHex, givenHex) {
  if (typeof givenHex !== 'string' || !/^[a-f0-9]{64}$/i.test(givenHex)) return false
  return crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(givenHex, 'hex'))
}

function checkoutSignatureMatches(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return false
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
  return safeEqualHex(expected, signature)
}

function webhookSignatureMatches(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret || !Buffer.isBuffer(rawBody)) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeEqualHex(expected, signature)
}

async function createOrderForRequest(request) {
  if (request.status === 'Cancelled') throw fail('This request was cancelled', 400, 'REQUEST_CANCELLED')
  if (request.paymentStatus === 'Paid') throw fail('This request is already paid', 400, 'ALREADY_PAID')
  if (request.paymentStatus !== 'Unpaid' || !(request.charge >= 1)) {
    throw fail('There is nothing to pay for this request', 400, 'NOTHING_TO_PAY')
  }

  const amount = request.charge
  const recent = await Payment.findOne({
    tenantId: request.tenantId,
    serviceRequestId: request._id,
    status: 'Pending',
    amount,
    createdAt: { $gte: new Date(Date.now() - REUSE_PENDING_MS) }
  }).sort({ createdAt: -1 })

  if (recent) return { orderId: recent.orderId, amountInPaise: Math.round(amount * 100) }

  const order = await getRazorpay().orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt: `${request.requestNumber}_${Date.now()}`.slice(0, 40),
    notes: {
      tenantId: String(request.tenantId),
      serviceRequestId: String(request._id),
      requestNumber: request.requestNumber
    }
  })

  await Payment.create({
    tenantId: request.tenantId,
    customerId: String(request.customerId),
    customerRef: request.customerId,
    serviceRequestId: request._id,
    orderId: order.id,
    amount,
    currency: 'INR',
    status: 'Pending',
    paymentMethod: 'Razorpay'
  })

  return { orderId: order.id, amountInPaise: order.amount }
}

async function markPaid(payment, paymentId, verifiedBy) {
  const paidAt = new Date()
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: 'Success' } },
    { $set: { paymentId, status: 'Success', verifiedBy, paidAt, failureReason: '' } },
    { returnDocument: 'after' }
  )

  if (!updated) {
    const current = await Payment.findById(payment._id).lean()
    return { alreadyDone: true, samePayment: current?.paymentId === paymentId }
  }

  const request = await ServiceRequest.findOne({ _id: updated.serviceRequestId, tenantId: updated.tenantId })
  if (request && request.paymentStatus !== 'Paid') {
    request.paymentStatus = 'Paid'
    request.paidAt = paidAt
    request.updates.push({
      status: request.status,
      note: `Payment of Rs ${updated.amount} received`,
      byName: 'Payment',
      byRole: 'SYSTEM'
    })
    await request.save()
  }

  return { alreadyDone: false, samePayment: true }
}

async function noteFailure(orderId, reason) {
  await Payment.updateOne(
    { orderId, status: 'Pending' },
    { $set: { failureReason: String(reason || 'Payment failed').slice(0, 300) } }
  )
}

module.exports = {
  fail,
  checkoutSignatureMatches,
  webhookSignatureMatches,
  createOrderForRequest,
  markPaid,
  noteFailure
}