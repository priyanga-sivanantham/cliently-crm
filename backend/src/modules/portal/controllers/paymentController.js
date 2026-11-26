const mongoose = require('mongoose')
const Payment = require('../../../models/Payment')
const ServiceRequest = require('../../../models/ServiceRequest')
const payments = require('../../../services/paymentService')

async function startPayment(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw payments.fail('Service request not found', 404, 'NOT_FOUND')
    const request = await ServiceRequest.findOne({
      _id: req.params.id,
      tenantId: req.customer.tenantId,
      customerId: req.customer.customerId
    })
    if (!request) throw payments.fail('Service request not found', 404, 'NOT_FOUND')

    const { orderId, amountInPaise } = await payments.createOrderForRequest(request)
    const profile = req.customer.profile

    res.status(201).json({
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId,
      amount: amountInPaise,
      currency: 'INR',
      companyName: profile.company.name,
      description: `${request.serviceType} - ${request.requestNumber}`,
      prefill: { name: profile.name, email: profile.email, contact: profile.phone }
    })
  } catch (err) {
    if (err.statusCode) return next(err)
    console.error('Portal payment order error:', err.message)
    next(payments.fail('Could not start the payment. Please try again.', 502, 'GATEWAY_ERROR'))
  }
}

async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body
    if (![orderId, paymentId, signature].every((v) => typeof v === 'string' && v.length <= 100)) {
      throw payments.fail('Payment details are missing', 400, 'BAD_REQUEST')
    }

    const payment = await Payment.findOne({
      orderId,
      tenantId: req.customer.tenantId,
      customerRef: req.customer.customerId
    })
    if (!payment) throw payments.fail('Payment not found', 404, 'NOT_FOUND')

    if (!payments.checkoutSignatureMatches(orderId, paymentId, signature)) {
      throw payments.fail('Payment could not be verified. If money was deducted, it will be confirmed shortly.', 400, 'BAD_SIGNATURE')
    }

    const result = await payments.markPaid(payment, paymentId, 'checkout')
    if (result.alreadyDone && !result.samePayment) {
      throw payments.fail('This payment was already processed', 409, 'ALREADY_PROCESSED')
    }

    res.json({ message: 'Payment successful', paymentId, serviceRequestId: payment.serviceRequestId })
  } catch (err) {
    next(err)
  }
}

async function reportFailure(req, res, next) {
  try {
    const orderId = typeof req.body.razorpay_order_id === 'string' ? req.body.razorpay_order_id : ''
    if (orderId) {
      const payment = await Payment.findOne({
        orderId,
        tenantId: req.customer.tenantId,
        customerRef: req.customer.customerId
      }).select('_id')
      if (payment) await payments.noteFailure(orderId, req.body.reason)
    }
    res.json({ message: 'Noted' })
  } catch (err) {
    next(err)
  }
}

module.exports = { startPayment, verifyPayment, reportFailure }