const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

const {
  authenticateUser,
  authorizeRoles
} = require("../middleware/authMiddleware");

const send = (res, status, payload) => {
  res.writeHead(status, {
    "Content-Type": "application/json"
  });
  res.end(JSON.stringify(payload));
};

const validPoint = (lat, lng) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  Number(lat) >= -90 &&
  Number(lat) <= 90 &&
  Number(lng) >= -180 &&
  Number(lng) <= 180;

const idOf = (value) =>
  ObjectId.isValid(String(value || ""))
    ? new ObjectId(String(value))
    : null;

module.exports = async function trackingRoutes(req, res, body = {}) {
  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  if (!url.pathname.startsWith("/api/tracking")) {
    return false;
  }

  const auth = authenticateUser(req);

  if (!auth.success) {
    send(res, auth.status, {
      success: false,
      message: auth.message
    });
    return true;
  }

  try {
    const db = getDB();
    const bookings = db.collection("bookings");
    const locations = db.collection("vehicleLocations");
    const userId = String(auth.user.userId);

    // OWNER FLEET
    if (
      req.method === "GET" &&
      url.pathname === "/api/tracking/owner/fleet"
    ) {
      const role = authorizeRoles(auth.user, ["owner"]);

      if (!role.success) {
        send(res, role.status, {
          success: false,
          message: role.message
        });
        return true;
      }

      const rows = await bookings
        .find({
          ownerId: userId,
          status: { $in: ["confirmed", "active"] }
        })
        .sort({ createdAt: -1 })
        .toArray();

      const vehicleIds = rows
        .map((booking) => idOf(booking.vehicleId))
        .filter(Boolean);

      const vehicles = vehicleIds.length
        ? await db.collection("vehicles")
            .find({ _id: { $in: vehicleIds } })
            .toArray()
        : [];

      const vehicleMap = new Map(
        vehicles.map((vehicle) => [
          String(vehicle._id),
          vehicle
        ])
      );

      const bookingIds = rows.map(
        (booking) => String(booking._id)
      );

      const locationRows = bookingIds.length
        ? await locations.find({
            bookingId: { $in: bookingIds }
          }).toArray()
        : [];

      const locationMap = new Map(
        locationRows.map((location) => [
          location.bookingId,
          location
        ])
      );

      send(res, 200, {
        success: true,
        bookings: rows.map((booking) => {
          const tracking =
            locationMap.get(String(booking._id)) || null;

          return {
            ...booking,
            vehicle:
              vehicleMap.get(String(booking.vehicleId)) || null,
            customer: {
              name: "Customer",
              customerId: booking.customerId
            },
            gpsSharingEnabled:
              booking.gpsSharingEnabled === true,
            gpsConsentAt: booking.gpsConsentAt || null,
            gpsSharingPausedAt:
              booking.gpsSharingPausedAt || null,

            // Do not expose old GPS positions when sharing is disabled.
            tracking: booking.gpsSharingEnabled === true
              ? tracking
              : tracking
                ? { ...tracking, latest: null, trail: [] }
                : null
          };
        })
      });

      return true;
    }

    // CUSTOMER ACTIVE RENTALS
    if (
      req.method === "GET" &&
      url.pathname === "/api/tracking/customer/active"
    ) {
      const role = authorizeRoles(auth.user, ["customer"]);

      if (!role.success) {
        send(res, role.status, {
          success: false,
          message: role.message
        });
        return true;
      }

      const rows = await bookings
        .find({
          customerId: userId,
          status: "active",
          trackingActive: true
        })
        .sort({ createdAt: -1 })
        .toArray();

      const vehicleIds = rows
        .map((booking) => idOf(booking.vehicleId))
        .filter(Boolean);

      const vehicles = vehicleIds.length
        ? await db.collection("vehicles")
            .find({ _id: { $in: vehicleIds } })
            .toArray()
        : [];

      const vehicleMap = new Map(
        vehicles.map((vehicle) => [
          String(vehicle._id),
          vehicle
        ])
      );

      send(res, 200, {
        success: true,
        bookings: rows.map((booking) => ({
          ...booking,
          vehicle:
            vehicleMap.get(String(booking.vehicleId)) || null,
          gpsSharingEnabled:
            booking.gpsSharingEnabled === true
        }))
      });

      return true;
    }

    // OWNER STARTS RENTAL
    const startMatch = url.pathname.match(
      /^\/api\/tracking\/([a-f\d]{24})\/start$/i
    );

    if (req.method === "POST" && startMatch) {
      const role = authorizeRoles(auth.user, ["owner"]);

      if (!role.success) {
        send(res, role.status, {
          success: false,
          message: role.message
        });
        return true;
      }

      const bookingId = startMatch[1];
      const now = new Date();

      const result = await bookings.updateOne(
        {
          _id: new ObjectId(bookingId),
          ownerId: userId,
          status: "confirmed"
        },
        {
          $set: {
            status: "active",
            trackingActive: true,
            gpsSharingEnabled: false,
            gpsConsentAt: null,
            gpsSharingPausedAt: null,
            trackingStartedAt: now,
            updatedAt: now
          }
        }
      );

      if (!result.matchedCount) {
        send(res, 409, {
          success: false,
          message:
            "Confirmed booking not found. It may already be active or cancelled."
        });
        return true;
      }

      send(res, 200, {
        success: true,
        message:
          "Rental activated. The customer can now choose to enable GPS sharing."
      });

      return true;
    }

    // CUSTOMER ENABLES GPS SHARING
    const consentMatch = url.pathname.match(
      /^\/api\/tracking\/([a-f\d]{24})\/consent$/i
    );

    if (req.method === "POST" && consentMatch) {
      const role = authorizeRoles(auth.user, ["customer"]);

      if (!role.success) {
        send(res, role.status, {
          success: false,
          message: role.message
        });
        return true;
      }

      const bookingId = consentMatch[1];
      const now = new Date();

      const result = await bookings.updateOne(
        {
          _id: new ObjectId(bookingId),
          customerId: userId,
          status: "active",
          trackingActive: true
        },
        {
          $set: {
            gpsSharingEnabled: true,
            gpsConsentAt: now,
            gpsSharingPausedAt: null,
            updatedAt: now
          }
        }
      );

      if (!result.matchedCount) {
        send(res, 403, {
          success: false,
          message:
            "GPS sharing can only be enabled for your active rental."
        });
        return true;
      }

      send(res, 200, {
        success: true,
        gpsSharingEnabled: true,
        message: "You have enabled GPS sharing for this rental."
      });

      return true;
    }

    // CUSTOMER PAUSES GPS SHARING
    const pauseMatch = url.pathname.match(
      /^\/api\/tracking\/([a-f\d]{24})\/pause$/i
    );

    if (req.method === "POST" && pauseMatch) {
      const role = authorizeRoles(auth.user, ["customer"]);

      if (!role.success) {
        send(res, role.status, {
          success: false,
          message: role.message
        });
        return true;
      }

      const bookingId = pauseMatch[1];
      const now = new Date();

      const result = await bookings.updateOne(
        {
          _id: new ObjectId(bookingId),
          customerId: userId,
          status: "active",
          trackingActive: true
        },
        {
          $set: {
            gpsSharingEnabled: false,
            gpsSharingPausedAt: now,
            updatedAt: now
          }
        }
      );

      if (!result.matchedCount) {
        send(res, 403, {
          success: false,
          message:
            "GPS sharing can only be paused for your active rental."
        });
        return true;
      }

      send(res, 200, {
        success: true,
        gpsSharingEnabled: false,
        message: "GPS sharing has been paused."
      });

      return true;
    }

    // CUSTOMER SENDS GPS LOCATION
    const locationMatch = url.pathname.match(
      /^\/api\/tracking\/([a-f\d]{24})\/location$/i
    );

    if (req.method === "PUT" && locationMatch) {
      const role = authorizeRoles(auth.user, ["customer"]);

      if (!role.success) {
        send(res, role.status, {
          success: false,
          message: role.message
        });
        return true;
      }

      const { latitude, longitude, accuracy } = body;

      if (!validPoint(latitude, longitude)) {
        send(res, 400, {
          success: false,
          message:
            "Valid GPS latitude and longitude are required."
        });
        return true;
      }

      if (
        accuracy !== undefined &&
        accuracy !== null &&
        (!Number.isFinite(Number(accuracy)) ||
          Number(accuracy) < 0)
      ) {
        send(res, 400, {
          success: false,
          message:
            "GPS accuracy must be a valid non-negative number."
        });
        return true;
      }

      const bookingId = locationMatch[1];

      const booking = await bookings.findOne({
        _id: new ObjectId(bookingId),
        customerId: userId,
        status: "active",
        trackingActive: true,
        gpsSharingEnabled: true
      });

      if (!booking) {
        send(res, 403, {
          success: false,
          message:
            "GPS sharing is not enabled for this active booking."
        });
        return true;
      }

      const point = {
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy:
          accuracy !== undefined && accuracy !== null
            ? Number(accuracy)
            : null,
        recordedAt: new Date()
      };

      await locations.updateOne(
        { bookingId },
        {
          $set: {
            bookingId,
            vehicleId: String(booking.vehicleId),
            ownerId: String(booking.ownerId),
            customerId: userId,
            latest: point,
            updatedAt: point.recordedAt
          },
          $push: {
            trail: {
              $each: [point],
              $slice: -1500
            }
          },
          $setOnInsert: {
            destination: null,
            createdAt: new Date()
          }
        },
        { upsert: true }
      );

      const stillEnabled = await bookings.findOne({
        _id: new ObjectId(bookingId),
        customerId: userId,
        status: "active",
        trackingActive: true,
        gpsSharingEnabled: true
      });

      if (!stillEnabled) {
        send(res, 403, {
          success: false,
          message:
            "GPS sharing has been paused or the rental has ended."
        });
        return true;
      }

      send(res, 200, {
        success: true,
        message: "Customer GPS location saved.",
        location: point
      });

      return true;
    }

    // CUSTOMER SETS DESTINATION
    const destinationMatch = url.pathname.match(
      /^\/api\/tracking\/([a-f\d]{24})\/destination$/i
    );

    if (req.method === "PUT" && destinationMatch) {
      const role = authorizeRoles(auth.user, ["customer"]);

      if (!role.success) {
        send(res, role.status, {
          success: false,
          message: role.message
        });
        return true;
      }

      const { name, latitude, longitude } = body;

      if (
        !String(name || "").trim() ||
        !validPoint(latitude, longitude)
      ) {
        send(res, 400, {
          success: false,
          message:
            "Destination name and valid coordinates are required."
        });
        return true;
      }

      const bookingId = destinationMatch[1];

      const booking = await bookings.findOne({
        _id: new ObjectId(bookingId),
        customerId: userId,
        status: "active",
        trackingActive: true
      });

      if (!booking) {
        send(res, 403, {
          success: false,
          message:
            "Destination can only be set during your active rental."
        });
        return true;
      }

      await locations.updateOne(
        { bookingId },
        {
          $set: {
            bookingId,
            customerId: userId,
            ownerId: String(booking.ownerId),
            destination: {
              name: String(name).trim().slice(0, 160),
              latitude: Number(latitude),
              longitude: Number(longitude),
              updatedAt: new Date()
            },
            updatedAt: new Date()
          },
          $setOnInsert: {
            trail: [],
            createdAt: new Date()
          }
        },
        { upsert: true }
      );

      send(res, 200, {
        success: true,
        message: "Destination saved."
      });

      return true;
    }

    // GET TRACKING DETAILS
    const detailMatch = url.pathname.match(
      /^\/api\/tracking\/([a-f\d]{24})$/i
    );

    if (req.method === "GET" && detailMatch) {
      const bookingId = detailMatch[1];

      const booking = await bookings.findOne({
        _id: new ObjectId(bookingId),
        $or: [
          { customerId: userId },
          { ownerId: userId }
        ],
        status: "active",
        trackingActive: true
      });

      if (!booking) {
        send(res, 404, {
          success: false,
          message:
            "No active tracking session is available for this booking."
        });
        return true;
      }

      const tracking = await locations.findOne({ bookingId });

      send(res, 200, {
        success: true,
        tracking: true,
        gpsSharingEnabled:
          booking.gpsSharingEnabled === true,
        gpsConsentAt: booking.gpsConsentAt || null,
        location:
          booking.gpsSharingEnabled === true
            ? tracking?.latest || null
            : null,
        trail:
          booking.gpsSharingEnabled === true
            ? tracking?.trail || []
            : [],
        destination: tracking?.destination || null
      });

      return true;
    }

    // OWNER COMPLETES RENTAL
    const stopMatch = url.pathname.match(
      /^\/api\/tracking\/([a-f\d]{24})\/stop$/i
    );

    if (req.method === "POST" && stopMatch) {
      const role = authorizeRoles(auth.user, ["owner"]);

      if (!role.success) {
        send(res, role.status, {
          success: false,
          message: role.message
        });
        return true;
      }

      const bookingId = stopMatch[1];
      const now = new Date();

      const result = await bookings.updateOne(
        {
          _id: new ObjectId(bookingId),
          ownerId: userId,
          status: "active",
          trackingActive: true
        },
        {
          $set: {
            status: "completed",
            trackingActive: false,
            gpsSharingEnabled: false,
            gpsSharingPausedAt: now,
            completedAt: now,
            updatedAt: now
          }
        }
      );

      if (!result.matchedCount) {
        send(res, 404, {
          success: false,
          message: "Active rental not found."
        });
        return true;
      }

      send(res, 200, {
        success: true,
        message:
          "Rental completed. GPS sharing has been disabled."
      });

      return true;
    }

    send(res, 404, {
      success: false,
      message: "Tracking API route not found."
    });

    return true;

  } catch (error) {
    console.error("Tracking API error:", error);

    send(res, 500, {
      success: false,
      message: "Tracking request failed."
    });

    return true;
  }
};