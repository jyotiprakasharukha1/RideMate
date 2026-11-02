
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

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

const validDate = (value) => {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

// End date is exclusive.
const overlaps = (startDate, endDate) => ({
  startDate: { $lt: endDate },
  endDate: { $gt: startDate },
  status: { $in: ["confirmed", "active"] }
});

module.exports = async function bookingRoutes(req, res, body = {}) {
  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  if (!url.pathname.startsWith("/api/bookings")) {
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
    const vehicles = db.collection("vehicles");

    const userId = String(auth.user.userId);

    // CUSTOMER: CREATE BOOKING
    if (
      req.method === "POST" &&
      url.pathname === "/api/bookings"
    ) {
      const permission = authorizeRoles(auth.user, ["customer"]);

      if (!permission.success) {
        send(res, permission.status, {
          success: false,
          message: permission.message
        });
        return true;
      }

      const { vehicleId, startDate, endDate } = body;

      if (
        !ObjectId.isValid(String(vehicleId || "")) ||
        !validDate(startDate) ||
        !validDate(endDate) ||
        endDate <= startDate
      ) {
        send(res, 400, {
          success: false,
          message: "Please provide a valid vehicle and rental date range."
        });
        return true;
      }

      const today = new Date().toISOString().slice(0, 10);

      if (startDate < today) {
        send(res, 400, {
          success: false,
          message: "Booking cannot start in the past."
        });
        return true;
      }

      const vehicle = await vehicles.findOne({
        _id: new ObjectId(vehicleId),
        status: "approved"
      });

      if (!vehicle) {
        send(res, 404, {
          success: false,
          message: "Approved vehicle not found."
        });
        return true;
      }

      const existingBooking = await bookings.findOne({
        vehicleId: String(vehicle._id),
        ...overlaps(startDate, endDate)
      });

      if (existingBooking) {
        send(res, 409, {
          success: false,
          message: "This vehicle is already booked for the selected dates."
        });
        return true;
      }

      const start = new Date(`${startDate}T00:00:00.000Z`);
      const end = new Date(`${endDate}T00:00:00.000Z`);

      const rentalDays = Math.ceil(
        (end.getTime() - start.getTime()) / 86400000
      );

      const dailyPrice = Number(vehicle.pricePerDay);

      if (!Number.isFinite(dailyPrice) || dailyPrice <= 0) {
        send(res, 400, {
          success: false,
          message: "Vehicle rental price is invalid."
        });
        return true;
      }

      const now = new Date();

      const newBooking = {
        vehicleId: String(vehicle._id),
        customerId: userId,
        ownerId: String(vehicle.ownerId),

        startDate,
        endDate,

        rentalDays,
        pricePerDay: dailyPrice,
        totalPrice: rentalDays * dailyPrice,

        status: "confirmed",

        trackingActive: false,
        gpsSharingEnabled: false,
        gpsConsentAt: null,
        gpsSharingPausedAt: null,

        createdAt: now,
        updatedAt: now
      };

      const result = await bookings.insertOne(newBooking);

      send(res, 201, {
        success: true,
        message: "Booking confirmed and saved successfully.",
        booking: {
          ...newBooking,
          _id: result.insertedId
        }
      });

      return true;
    }

    // CUSTOMER: GET OWN BOOKINGS
    if (
      req.method === "GET" &&
      url.pathname === "/api/bookings/my"
    ) {
      const permission = authorizeRoles(auth.user, ["customer"]);

      if (!permission.success) {
        send(res, permission.status, {
          success: false,
          message: permission.message
        });
        return true;
      }

      const rows = await bookings
        .find({ customerId: userId })
        .sort({ createdAt: -1 })
        .toArray();

      const vehicleIds = rows
        .map((booking) => {
          const id = String(booking.vehicleId || "");
          return ObjectId.isValid(id) ? new ObjectId(id) : null;
        })
        .filter(Boolean);

      const vehicleRows = vehicleIds.length
        ? await vehicles.find({
            _id: { $in: vehicleIds }
          }).toArray()
        : [];

      const vehicleMap = new Map(
        vehicleRows.map((vehicle) => [
          String(vehicle._id),
          vehicle
        ])
      );

      send(res, 200, {
        success: true,
        count: rows.length,
        bookings: rows.map((booking) => ({
          ...booking,
          vehicle:
            vehicleMap.get(String(booking.vehicleId)) || null
        }))
      });

      return true;
    }

    // CUSTOMER: CANCEL BOOKING
    const cancelMatch = url.pathname.match(
      /^\/api\/bookings\/([a-f\d]{24})\/cancel$/i
    );

    if (req.method === "PATCH" && cancelMatch) {
      const permission = authorizeRoles(auth.user, ["customer"]);

      if (!permission.success) {
        send(res, permission.status, {
          success: false,
          message: permission.message
        });
        return true;
      }

      const bookingId = cancelMatch[1];
      const now = new Date();

      const result = await bookings.updateOne(
        {
          _id: new ObjectId(bookingId),
          customerId: userId,
          status: "confirmed"
        },
        {
          $set: {
            status: "cancelled",
            trackingActive: false,
            gpsSharingEnabled: false,
            gpsSharingPausedAt: now,
            cancelledAt: now,
            updatedAt: now
          }
        }
      );

      if (!result.matchedCount) {
        send(res, 404, {
          success: false,
          message: "Booking not found or it can no longer be cancelled."
        });
        return true;
      }

      send(res, 200, {
        success: true,
        message: "Booking cancelled successfully."
      });

      return true;
    }

    send(res, 404, {
      success: false,
      message: "Booking API route not found."
    });

    return true;

  } catch (error) {
    console.error("Booking API error:", error);

    send(res, 500, {
      success: false,
      message: "Booking request failed."
    });

    return true;
  }
};
