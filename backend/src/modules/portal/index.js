const express = require('express')
const requireCustomerSession = require('../../middleware/requireCustomerSession')
const { me } = require('./controllers/authController')

const router = express.Router()
router.use((req, res, next) => {
  req.body = req.body || {}
  next()
})

router.use('/auth', require('./routes/authRoutes'))
router.use(requireCustomerSession)
router.get('/me', me)
router.use(require('./routes/profileRoutes'))
router.use(require('./routes/careRoutes'))
router.use(require('./routes/paymentRoutes'))
router.use((req, res) => res.status(404).json({ message: 'Not found' }))

module.exports = router