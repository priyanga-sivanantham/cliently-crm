const mongoose = require('mongoose')
const { ObjectId } = mongoose.Schema.Types

const SERVICE_TYPES = ['Installation', 'Filter Change', 'Repair', 'Maintenance', 'Other']
const REQUEST_STATUSES = ['Requested', 'Assigned', 'In Progress', 'Completed', 'Cancelled']
const PAYMENT_STATUSES = ['Not Required', 'Unpaid', 'Paid']
const updateSchema = new mongoose.Schema(
  {
    status: { type: String, enum: REQUEST_STATUSES, required: true },
    note: { type: String, default: '', trim: true, maxlength: 500 },
    byName: { type: String, default: '', trim: true },
    byRole: { type: String, default: '' },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
)

const serviceRequestSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    requestNumber: { type: String, required: true },
    customerId: { type: ObjectId, ref: 'Customer', required: true },
    customerProductId: { type: ObjectId, ref: 'CustomerProduct', default: null },
    productName: { type: String, default: '', trim: true },
    serviceType: { type: String, enum: SERVICE_TYPES, required: true },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    preferredDate: { type: Date, default: null },
    address: { type: String, default: '', trim: true, maxlength: 300 },
    status: { type: String, enum: REQUEST_STATUSES, default: 'Requested' },
    salesExecId: { type: ObjectId, ref: 'User', default: null },
    assignedTo: { type: ObjectId, ref: 'User', default: null },
    assignedToName: { type: String, default: '', trim: true },
    scheduledDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    charge: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Not Required' },
    paidAt: { type: Date, default: null },
    updates: { type: [updateSchema], default: [] }
  },
  { timestamps: true, versionKey: false, collection: 'service_requests' }
)

serviceRequestSchema.index({ tenantId: 1, requestNumber: 1 }, { unique: true })
serviceRequestSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 })
serviceRequestSchema.index({ tenantId: 1, salesExecId: 1, status: 1, createdAt: -1 })
serviceRequestSchema.index({ tenantId: 1, assignedTo: 1, status: 1, createdAt: -1 })
serviceRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 })

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema)
module.exports.SERVICE_TYPES = SERVICE_TYPES
module.exports.REQUEST_STATUSES = REQUEST_STATUSES
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES