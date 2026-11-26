require('dotenv').config()
const crypto = require('crypto')

const [orderId, paymentId = 'pay_TEST001'] = process.argv.slice(2)

if (!orderId) {
  console.error('Usage: node src/tests/testPaymentSignature.js <order_id> [payment_id]')
  process.exit(1)
}
if (!process.env.RAZORPAY_KEY_SECRET) {
  console.error('RAZORPAY_KEY_SECRET is not set in this folder\'s .env')
  process.exit(1)
}

const signature = crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET.trim())
  .update(`${orderId}|${paymentId}`)
  .digest('hex')

console.log('\nPaste this as the Postman body for POST /api/portal/payments/verify:\n')
console.log(JSON.stringify({
  razorpay_order_id: orderId,
  razorpay_payment_id: paymentId,
  razorpay_signature: signature
}, null, 2))
console.log('\nTest mode only. Never use this with live keys.\n')