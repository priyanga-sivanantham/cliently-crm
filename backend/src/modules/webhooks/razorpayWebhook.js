const express = require('express')
const Payment = require('../../models/Payment')
const payments = require('../../services/paymentService')

const router = express.Router()

router.post('/razorpay', express.raw({ type: 'application/json', limit: '100kb' }), async (req, res) => {
  if (!payments.webhookSignatureMatches(req.body, req.get('x-razorpay-signature'))) {
    return res.status(400).json({ message: 'Invalid signature' })
  }

  let event
  try {
    event = JSON.parse(req.body.toString('utf8'))
  } catch {
    return res.status(400).json({ message: 'Invalid body' })
  }

  try {
    const entity = event?.payload?.payment?.entity
    if (!entity?.order_id || !entity?.id) return res.json({ received: true })

    const payment = await Payment.findOne({ orderId: entity.order_id, serviceRequestId: { $ne: null } })
    if (!payment) return res.json({ received: true })

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      if (Number(entity.amount) !== Math.round(payment.amount * 100) || entity.currency !== payment.currency) {
        console.error(`Razorpay webhook amount mismatch for order ${entity.order_id}`)
        return res.json({ received: true })
      }
      await payments.markPaid(payment, entity.id, 'webhook')
    } else if (event.event === 'payment.failed') {
      await payments.noteFailure(entity.order_id, entity.error_description)
    }

    res.json({ received: true })
  } catch (err) {
    console.error('Razorpay webhook error:', err.message)
    res.status(500).json({ message: 'Webhook processing failed' })
  }
})

module.exports = router