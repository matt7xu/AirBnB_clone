const express = require('express');
const { Op } = require('sequelize');

const { setTokenCookie, requireAuth } = require('../../utils/auth');
const { User, Spot, Review, Spotimage, sequelize, Reviewimage, Booking } = require('../../db/models');

const { check } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

const router = express.Router();

const validateSpot = [
  check('address')
    .exists({ checkFalsy: true })
    .notEmpty()
    .withMessage("Street address is required"),
  check('city')
    .exists({ checkFalsy: true })
    .notEmpty()
    .withMessage("City is required"),
  check('state')
    .exists({ checkFalsy: true })
    .notEmpty()
    .withMessage("State is required"),
  check('country')
    .exists({ checkFalsy: true })
    .notEmpty()
    .withMessage("Country is required"),
  check('lat')
    .exists({ checkFalsy: true })
    .isDecimal()
    .notEmpty()
    .withMessage("Latitude is not valid"),
  check('lng')
    .exists({ checkFalsy: true })
    .isDecimal()
    .notEmpty()
    .withMessage("Longitude is not valid"),
  check('name')
    .isLength({ max: 50 })
    .withMessage("Name must be less than 50 characters"),
  check('description')
    .exists({ checkFalsy: true })
    .notEmpty()
    .withMessage("Description is required"),
  check('price')
    .exists({ checkFalsy: true })
    .notEmpty()
    .withMessage("Price per day is required"),
  handleValidationErrors
];

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

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

//Get all Bookings for a Spot based on the Spot's id
router.get(
  '/:id/bookings',
  requireAuth,
  async (req, res, next) => {
    const spotId = +req.params.id;
    const userId = +req.user.id;

    const bookings = await Booking.findAll({
      where: {
        spotId
      },
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName']
        },
      ],
      group: ["Booking.id", "User.id"]
    });

    const spot = await Spot.findByPk(spotId);

    if (!spot) {
      const err = new Error("Spot couldn't be found");
      err.message = "Spot couldn't be found";
      err.status = 404;
      next(err);
    }

    if (userId !== bookings[0].userId) {
      const notOwnerBookings = await Booking.findAll({
        where: {
          spotId
        },
        attributes: [
          "spotId",
          "startDate",
          "endDate"]
      });

      res.json({
        Booking: notOwnerBookings
      });
    }


    res.json({
      Booking: bookings
    });
  })

//Get all Reviews by a Spot's id
router.get(
  '/:id/reviews',
  async (req, res, next) => {
    const spotId = +req.params.id;

    const spot = await Spot.findByPk(spotId);

    if (!spot) {
      const err = new Error("Spot couldn't be found");
      err.message = "Spot couldn't be found";
      err.status = 404;
      next(err);
    }

    let reviews = await Review.findAll({
      where: {
        spotId
      },
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Reviewimage,
          as: "ReviewImages",
          attributes: ['id', 'url']
        }
      ],
      group: ["Review.id", "User.id", "ReviewImages.id"]
    });

    if (!spot) {
      const err = new Error("Spot couldn't be found");
      err.message = "Spot couldn't be found";
      err.status = 404;
      next(err);
    }

    res.json({
      Reviews: reviews
    });
  })



//Get details of a Spot from an id
router.get(
  '/:id',
  async (req, res, next) => {
    const id = +req.params.id;

    let spot = await Spot.findOne({
      where: {
        id
      },
      attributes: {
        include: [
          [
            sequelize.fn("COUNT", sequelize.col("Reviews.id")), "numReviews"
          ],
          [
            sequelize.fn("AVG", sequelize.col("Reviews.stars")), "avgStarRating"
          ]
        ],
      },
      include: [
        {
          model: Review,
          attributes: []
        },
        {
          model: Spotimage,
          as: "previewImage",
          attributes: ['id', 'url', 'preview']
        },
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName']
        },
      ],
      group: ["Spot.id", "previewImage.id", "User.id"]
    });

    if (!spot) {
      const err = new Error("Spot couldn't be found");
      err.message = "Spot couldn't be found";
      err.status = 404;
      next(err);
    }

    let ret = {};

    spot = spot.toJSON();

    ret.id = spot.id;
    ret.ownerId = spot.ownerId;
    ret.address = spot.address;
    ret.city = spot.city;
    ret.state = spot.state;
    ret.country = spot.country;
    ret.lat = spot.lat;
    ret.lng = spot.lng;
    ret.name = spot.name;
    ret.description = spot.description;
    ret.price = spot.price;
    ret.createdAt = spot.createdAt;
    ret.updatedAt = spot.updatedAt;
    ret.numReviews = spot.numReviews;
    ret.avgStarRating = spot.avgStarRating;
    ret.SpotImages = spot.previewImage;
    ret.Owner = spot.User;

    res.json(ret);
  })


//Get all Spots
router.get(
  '/',
  async (req, res) => {
    let { page, size, minLat, maxLat, minLng, maxLng, minPrice, maxPrice } = req.query;
    if (!page) page = 0;
    if (!size) size = 20;

    let pag = {};
    let where = {};

    if (!isNumeric(page) || parseInt(page) < 0) {
      const err = new Error("Validation Error");
      err.message = "Validation Error";
      err.status = 400;
      err.errors = "Page must be greater than or equal to 0";
      next(err);
    }

    if (!isNumeric(size) || parseInt(size) < 0) {
      const err = new Error("Validation Error");
      err.message = "Validation Error";
      err.status = 400;
      err.errors = "Size must be greater than or equal to 0";
      next(err);
    }

    if (minLat) {
      if (!isNumeric(minLat)) {
        const err = new Error("Validation Error");
        err.message = "Validation Error";
        err.status = 400;
        err.errors = "Minimum latitude is invalid";
        next(err);
      }
      minLat = parseFloat(minLat);
      where.lat = { [Op.gte]: minLat };
    };

    if (maxLat) {
      if (!isNumeric(maxLat)) {
        const err = new Error("Validation Error");
        err.message = "Validation Error";
        err.status = 400;
        err.errors = "Maximum latitude is invalid";
        next(err);
      }
      maxLat = parseFloat(maxLat);
      where.lat = { [Op.lte]: maxLat };
    };

    if (minLng) {
      if (!isNumeric(minLng)) {
        const err = new Error("Validation Error");
        err.message = "Validation Error";
        err.status = 400;
        err.errors = "Maximum longitude is invalid";
        next(err);
      }
      minLng = parseFloat(minLng);
      where.lng = { [Op.gte]: minLng };
    };

    if (maxLng) {
      if (!isNumeric(maxLng)) {
        const err = new Error("Validation Error");
        err.message = "Validation Error";
        err.status = 400;
        err.errors = "Maximum longitude is invalid";
        next(err);
      }
      maxLng = parseFloat(maxLng);
      where.lng = { [Op.lte]: maxLng };
    };

    if (minPrice) {
      if (!isNumeric(minPrice) || parseFloat(minPrice) < 0) {
        const err = new Error("Validation Error");
        err.message = "Validation Error";
        err.status = 400;
        err.errors = "Minimum price must be greater than or equal to 0";
        next(err);
      }
      minPrice = parseFloat(minPrice);
      where.price = { [Op.gte]: minPrice };
    };

    if (maxPrice) {
      if (!isNumeric(maxPrice) || parseFloat(maxPrice) < 0) {
        const err = new Error("Validation Error");
        err.message = "Validation Error";
        err.status = 400;
        err.errors = "Maximum price must be greater than or equal to 0";
        next(err);
      }
      maxPrice = parseFloat(maxPrice);
      where.price = { [Op.lte]: maxPrice };
    };

    page = parseInt(page);
    size = parseInt(size);

    let p = page;
    let s = size;

    if (p > 10) p = 10;
    if (s > 20) s = 20;
    pag.limit = s;
    pag.offset = s * p;


    const spots = await Spot.findAll({
      where,
      attributes: {
        include: [
          [
            sequelize.fn("AVG", sequelize.col("Reviews.stars")), "avgRating"
          ]
        ],
      },
      include: [
        {
          model: Review,
          attributes: []
        },
        {
          model: Spotimage,
          attributes: ['url'],
          as: "previewImage",
          where: { preview: true },
          required: false
        },
      ],
      group: ["Spot.id", "previewImage.id"],
      subQuery: false,
      ...pag
    });

    let ret = [];

    spots.forEach(spot => {

      spot = spot.toJSON();
      let each = {};
      each.id = spot.id;
      each.ownerId = spot.ownerId;
      each.address = spot.address;
      each.city = spot.city;
      each.state = spot.state;
      each.country = spot.country;
      each.lat = spot.lat;
      each.lng = spot.lng;
      each.name = spot.name;
      each.description = spot.description;
      each.price = spot.price;
      each.createdAt = spot.createdAt;
      each.updatedAt = spot.updatedAt;
      each.avgRating = Number(spot.avgRating).toFixed(1);
      let image = '';
      spot.previewImage.forEach(eachImage => {
        if (eachImage) {
          image += eachImage.url;
        }
      });
      each.previewImage = image;
      // each.previewImage = eachImage.url;
      ret.push(each);
    })
    res.json({
      Spots: ret,
      page: page,
      size: size
    });
  })

//Create a Booking from a Spot based on the Spot's id
router.post(
  '/:id/bookings',
  requireAuth,
  async (req, res, next) => {

    const spotId = +req.params.id;
    const { startDate, endDate } = req.body;
    const userId = +req.user.id;

    let sDate = new Date(startDate);
    let eDate = new Date(endDate);

    const spot = await Spot.findByPk(spotId);

    if (!spot) {
      const err = new Error("Spot couldn't be found");
      err.status = 404;
      next(err);
    }

    if (endDate <= startDate) {
      const err = new Error("Validation error");
      err.status = 400;
      err.errors = "endDate cannot be on or before startDate";
      next(err);
    }

    const currentBookingsStart = await Booking.findAll({
      where: {
        spotId,
        endDate: {
          [Op.between]: [sDate, eDate]
        }
      }
    });

    if (currentBookingsStart.length > 0) {
      const err = new Error("Sorry, this spot is already booked for the specified dates");
      err.status = 403;
      err.errors = "Start date conflicts with an existing booking";
      next(err);
    }

    const currentBookingsEnd = await Booking.findAll({
      where: {
        spotId,
        startDate: {
          [Op.between]: [sDate, eDate]
        }
      }
    });

    if (currentBookingsEnd.length > 0) {
      const err = new Error("Sorry, this spot is already booked for the specified dates");
      err.status = 403;
      err.errors = "End date conflicts with an existing booking";
      next(err);
    }

    if (currentBookingsStart.length === 0 && currentBookingsEnd.length === 0) {
      var newBooking = await Booking.create(
        {
          userId,
          spotId,
          startDate,
          endDate
        }
      );
    };

    res.status(201)
    res.json(newBooking)


  })

//Create a Review for a Spot based on the Spot's id
router.post(
  '/:id/reviews',
  validateReview,
  requireAuth,
  async (req, res, next) => {
    const spotId = +req.params.id;
    const { review, stars } = req.body;
    const userId = +req.user.id;

    const spot = await Spot.findByPk(spotId);

    if (!spot) {
      const err = new Error("Spot couldn't be found");
      err.status = 404;
      next(err);
    }

    const hasReview = await Review.findOne({
      where: {
        userId,
        spotId
      }
    })

    if (hasReview) {
      const err = new Error("User already has a review for this spot");
      err.status = 403;
      next(err);
    }

    const newReview = await spot.createReview(
      {
        userId,
        spotId,
        review,
        stars
      }
    );

    res.status(201)
    res.json(newReview)
  })

//Add an Image to a Spot based on the Spot's id
router.post(
  '/:id/images',
  requireAuth,
  async (req, res, next) => {
    const id = +req.params.id;
    const { url, preview } = req.body;

    const spot = await Spot.findByPk(id);

    if (!spot) {
      const err = new Error("Spot couldn't be found");
      err.status = 404;
      next(err);
    }

    if (spot.ownerId !== req.user.id) {
      const err = new Error("Forbidden");
      err.message = "Forbidden";
      err.status = 403;
      return next(err);
    }

    // const newImage = await spot.createSpotimage(
    //   {
    //     url,
    //     preview
    //   }
    // );

    const newImage = await Spotimage.create(
      {
        spotId: id,
        url,
        preview
      }
    );

    res.status(200)
    res.json({
      id: newImage.id,
      url: newImage.url,
      preview: newImage.preview
    })
  })

//Create a Spot
router.post(
  '/',
  validateSpot,
  requireAuth,
  async (req, res) => {
    const ownerId = +req.user.id;
    const { address, city, state, country, lat, lng, name, description, price } = req.body;

    const owner = await User.findByPk(ownerId);

    const spot = await owner.createSpot(
      {
        ownerId,
        address,
        city,
        state,
        country,
        lat,
        lng,
        name,
        description,
        price
      }
    );

    res.status(201)
    res.json(spot)
  })

//Edit a Spot
router.put(
  '/:id',
  validateSpot,
  requireAuth,
  async (req, res, next) => {
    const spotId = +req.params.id;
    const { address, city, state, country, lat, lng, name, description, price } = req.body;

    const spot = await Spot.findByPk(spotId);

    if (!spot) {
      const err = new Error("Spot couldn't be found");
      err.message = "Spot couldn't be found";
      err.status = 404;
      return next(err);
    }

    if (spot.ownerId !== req.user.id) {
      const err = new Error("Forbidden");
      err.message = "Forbidden";
      err.status = 403;
      return next(err);
    }

    spot.address = address;
    spot.city = city;
    spot.state = state;
    spot.country = country;
    spot.lat = lat;
    spot.lng = lng;
    spot.name = name;
    spot.description = description;
    spot.price = price;
    await spot.save()

    res.status(200)
    res.json(spot)
  })

//Delete a Spot Image
router.delete(
  '/images/:id',
  requireAuth,
  async (req, res, next) => {
    const spotimageId = +req.params.id;

    const deleteSpotImage = await Spotimage.findByPk(spotimageId);

    if (!deleteSpotImage) {
      const err = new Error("Spot Image couldn't be found");
      err.message = "Spot Image couldn't be found";
      err.status = 404;
      return next(err);
    }

    const spot = await Spot.findByPk(deleteSpotImage.spotId);

    if (spot.ownerId !== req.user.id) {
      const err = new Error("Forbidden");
      err.message = "Forbidden";
      err.status = 403;
      return next(err);
    }

    await deleteSpotImage.destroy();

    res.json({
      message: 'Successfully deleted',
      "statusCode": 200
    })
  }
);

//Delete a Spot
router.delete(
  '/:id',
  requireAuth,
  async (req, res, next) => {
    const spotId = +req.params.id;

    const spot = await Spot.findByPk(spotId);

    if (!spot) {
      const err = new Error("Spot couldn't be found");
      err.message = "Spot couldn't be found";
      err.status = 404;
      return next(err);
    }

    if (spot.ownerId !== req.user.id) {
      const err = new Error("Forbidden");
      err.message = "Forbidden";
      err.status = 403;
      return next(err);
    }

    await spot.destroy();

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
