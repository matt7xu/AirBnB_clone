const express = require('express');

const { setTokenCookie, requireAuth } = require('../../utils/auth');
const { User, Spot, Review, Spotimage, sequelize, Reviewimage } = require('../../db/models');

const { check } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

const router = express.Router();


const validateReview = [
  check('review')
    .exists({ checkFalsy: true })
    .notEmpty()
    .withMessage("Review text is required"),
  check('stars')
    .exists({ checkFalsy: true })
    .isDecimal()
    .notEmpty()
    .isIn([1, 2, 3, 4, 5])
    .withMessage("Stars must be an integer from 1 to 5"),
  handleValidationErrors
];

//Add an Image to a Review based on the Review's id
router.post(
  '/:id/images',
  requireAuth,
  async (req, res, next) => {
    const reviewId = +req.params.id;
    const { url } = req.body;
    const userId = +req.user.id;

    const review = await Review.findByPk(reviewId);

    if (!review) {
      const err = new Error("Review couldn't be found");
      err.status = 404;
      next(err);
    }

    if (userId !== review.userId) {
      const err = new Error("Forbidden");
      err.status = 403;
      return next(err);
    }

    const has10Images = await Reviewimage.findAll({
      where: {
        reviewId
      }
    });

    if (has10Images.length > 10) {
      const err = new Error("Maximum number of images for this resource was reached");
      err.status = 403;
      return next(err);
    }

    const newReviewImage = await Reviewimage.create(
      {
        reviewId,
        spotId: review.spotId,
        url
      }
    );

    res.status(200)
    res.json({
      id: newReviewImage.id,
      url: newReviewImage.url
    })
  })

//Edit a Review
router.put(
  '/:id',
  validateReview,
  requireAuth,
  async (req, res, next) => {
    const reviewId = +req.params.id;
    const { review, stars } = req.body;

    const updateReview = await Review.findByPk(reviewId);

    if (!updateReview) {
      const err = new Error("Review couldn't be found");
      err.message = "Review couldn't be found";
      err.status = 404;
      return next(err);
    }

    if (updateReview.userId !== req.user.id) {
      const err = new Error("Forbidden");
      err.message = "Forbidden";
      err.status = 403;
      return next(err);
    }

    updateReview.review = review;
    updateReview.stars = stars;
    await updateReview.save()

    res.status(200)
    res.json(updateReview)
  })

//Delete a Review Image
router.delete(
  '/images/:id',
  requireAuth,
  async (req, res, next) => {
    const reviewimageId = +req.params.id;

    const deleteReviewImage = await Reviewimage.findByPk(reviewimageId);

    if (!deleteReviewImage) {
      const err = new Error("Review Image couldn't be found");
      err.message = "Review Image couldn't be found";
      err.status = 404;
      return next(err);
    }

    const review = await Review.findByPk(deleteReviewImage.reviewId);

    if (review.userId !== req.user.id) {
      const err = new Error("Forbidden");
      err.message = "Forbidden";
      err.status = 403;
      return next(err);
    }

    await deleteReviewImage.destroy();

    res.json({
      message: 'Successfully deleted',
      "statusCode": 200
    })
  }
);

//Delete a Review
router.delete(
  '/:id',
  requireAuth,
  async (req, res, next) => {
    const reviewId = +req.params.id;

    const review = await Review.findByPk(reviewId);

    if(!review) {
      const err = new Error("Spot couldn't be found");
      err.message = "Spot couldn't be found";
      err.status = 404;
      return next(err);
    }

    if (review.userId !== req.user.id) {
      const err = new Error("Forbidden");
      err.message = "Forbidden";
      err.status = 403;
      return next(err);
    }

    await review.destroy();

    res.json({
      message: 'Successfully deleted',
      "statusCode": 200
    })
  }
);

// Error formatter
router.use((err, _req, res, _next) => {
  res.status(err.status || 500);
  console.error(err);

  let errMessage = {
    message: err.message,
    statusCode: err.status
  }
  if (err.errors) {
    errMessage.errors = [err.errors]
  }
  res.json(
    //title: err.title || 'Server Error',
    // message: err.message,
    // statusCode: err.status,
    // errors: [err.errors]
    //stack: isProduction ? null : err.stack
    errMessage
  );
});
module.exports = router;
