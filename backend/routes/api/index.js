const router = require('express').Router();
const sessionRouter = require('./session.js');
const usersRouter = require('./users.js');
const spotsRouter = require('./spots.js');
const reviewsRouter = require('./reviews.js');
const bookingsRouter = require('./bookings.js');
//const { User } = require('../../db/models');
//const { setTokenCookie } = require('../../utils/auth.js');
const { restoreUser } = require('../../utils/auth.js');
//const { requireAuth } = require('../../utils/auth.js');

router.use(restoreUser);

// router.post('/test', function(req, res) {
//   res.json({ requestBody: req.body });
// });

router.use('/session', sessionRouter);
router.use('/users', usersRouter);
router.use('/spots', spotsRouter);
router.use('/reviews', reviewsRouter);
router.use('/bookings', bookingsRouter);

//GET /api/set-token-cookie

// router.get('/set-token-cookie', async (_req, res) => {
//   const user = await User.findOne({
//     where: {
//       username: 'Demo-lition'
//     }
//   });
//   setTokenCookie(res, user);
//   return res.json({ user: user });
// });

// GET /api/restore-user


// router.get(
//   '/restore-user',
//   (req, res) => {
//     return res.json(req.user);
//   }
// );

// GET /api/require-auth

// router.get(
//   '/require-auth',
//   requireAuth,
//   (req, res) => {
//     return res.json(req.user);
//   }
// );

module.exports = router;
