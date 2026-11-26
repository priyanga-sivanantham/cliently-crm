const express = require('express')
const { startPayment, verifyPayment, reportFailure } = require('../controllers/paymentController')

const router = express.Router()

router.post('/service-requests/:id/pay', startPayment)
router.post('/payments/verify', verifyPayment)
router.post('/payments/failed', reportFailure)

module.exports = router