const mongoose = require('mongoose')
const { ObjectId } = mongoose.Schema.Types

const PAYMENT_STATUSES = ['Pending', 'Success', 'Failed']
const VERIFIED_BY = ['checkout', 'webhook', 'manual']

const paymentSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', index: true },
    customerId: { type: String, required: true },
    saleId: { type: String, default: '' },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String, default: '' },
    amount: { type: Number, required: true, min: [1, 'Amount must be at least ₹1'] },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'Pending' },
    paymentMethod: { type: String, default: 'Razorpay' },
    serviceRequestId: { type: ObjectId, ref: 'ServiceRequest', default: null },
    customerRef: { type: ObjectId, ref: 'Customer', default: null },
    verifiedBy: { type: String, enum: VERIFIED_BY },
    failureReason: { type: String, trim: true, maxlength: 300 },
    paidAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'payments' }
)

paymentSchema.index(
  { paymentId: 1 },
  { unique: true, partialFilterExpression: { paymentId: { $gt: '' } } }
)
paymentSchema.index({ tenantId: 1, saleId: 1, createdAt: -1 })
paymentSchema.index({ tenantId: 1, status: 1, paidAt: -1 })
paymentSchema.index({ tenantId: 1, serviceRequestId: 1, createdAt: -1 })
module.exports = mongoose.model('Payment', paymentSchema)
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES