const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

const {
  authenticateUser,
  authorizeRoles
} = require("../middleware/authMiddleware");
const isValidDate = (value) => {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

module.exports = async function vehicleRoutes(req, res, body) {
  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  // GET: Approved vehicles with optional date availability
  if (req.method === "GET" && url.pathname === "/api/vehicles") {
    try {
      const db = getDB();

      const filter = { status: "approved" };

      const type = url.searchParams.get("type");

      if (type && ["car", "bike"].includes(type.toLowerCase())) {
        filter.type = type.toLowerCase();
      }

      const search = url.searchParams.get("search");

      if (search) {
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        filter.$or = [
          { brand: { $regex: escapedSearch, $options: "i" } },
          { model: { $regex: escapedSearch, $options: "i" } },
          { location: { $regex: escapedSearch, $options: "i" } }
        ];
      }

      const vehicles = await db.collection("vehicles")
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();

      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");

      let availableVehicles = vehicles;

      if (
  isValidDate(startDate) &&
  isValidDate(endDate) &&
  endDate > startDate
) {
        const busy = await db.collection("bookings").find({
  vehicleId: { $in: vehicles.map(v => String(v._id)) },

  // Existing booking must start before the requested end date.
  startDate: { $lt: endDate },

  // Existing booking must end after the requested start date.
  endDate: { $gt: startDate },

  status: { $in: ["confirmed", "active"] }
}).project({ vehicleId: 1 }).toArray();

        const unavailableIds = new Set(
          busy.map(b => b.vehicleId)
        );

        availableVehicles = vehicles.filter(
          v => !unavailableIds.has(String(v._id))
        );
      }

      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: true,
        count: availableVehicles.length,
        vehicles: availableVehicles
      }));

    } catch (error) {
      console.error("Fetch vehicles error:", error);

      res.writeHead(500, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: false,
        message: "Failed to fetch vehicles"
      }));
    }

    return true;
  }

  // POST: Owner submits a vehicle
  if (req.method === "POST" && url.pathname === "/api/vehicles") {
    try {
      const auth = authenticateUser(req);

      if (!auth.success) {
        res.writeHead(auth.status, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: auth.message
        }));
        return true;
      }

      const permission = authorizeRoles(auth.user, ["owner"]);

      if (!permission.success) {
        res.writeHead(permission.status, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: permission.message
        }));
        return true;
      }

      const {
        type,
        brand,
        model,
        year,
        pricePerDay,
        location,
        latitude,
        longitude,
        description,
        images
      } = body;

      if (!type || !brand || !model || !pricePerDay || !location) {
        res.writeHead(400, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: "Please provide type, brand, model, pricePerDay and location"
        }));
        return true;
      }

      if (!["car", "bike"].includes(type.toLowerCase())) {
        res.writeHead(400, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: "Vehicle type must be car or bike"
        }));
        return true;
      }

      const price = Number(pricePerDay);

      if (!Number.isFinite(price) || price <= 0) {
        res.writeHead(400, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: "Please enter a valid daily rental price"
        }));
        return true;
      }

      const hasLatitude = latitude !== undefined && latitude !== null;
      const hasLongitude = longitude !== undefined && longitude !== null;

      if (hasLatitude !== hasLongitude) {
        res.writeHead(400, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: "Both latitude and longitude must be provided"
        }));
        return true;
      }

      if (hasLatitude) {
        const lat = Number(latitude);
        const lng = Number(longitude);

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        ) {
          res.writeHead(400, {
            "Content-Type": "application/json"
          });
          res.end(JSON.stringify({
            success: false,
            message: "Invalid GPS coordinates"
          }));
          return true;
        }
      }

      if (images !== undefined && !Array.isArray(images)) {
        res.writeHead(400, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: "Images must be an array"
        }));
        return true;
      }

      const db = getDB();

      const newVehicle = {
        ownerId: auth.user.userId,
        type: type.toLowerCase(),
        brand: brand.trim(),
        model: model.trim(),
        year: year ? Number(year) : null,
        pricePerDay: price,
        location: location.trim(),

        coordinates: hasLatitude
          ? {
              latitude: Number(latitude),
              longitude: Number(longitude)
            }
          : null,

        description: description ? description.trim() : "",
        images: images || [],
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection("vehicles").insertOne(newVehicle);

      res.writeHead(201, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: true,
        message: "Vehicle submitted successfully. Waiting for admin approval.",
        vehicleId: result.insertedId,
        vehicle: newVehicle
      }));

    } catch (error) {
      console.error("Submit vehicle error:", error);

      res.writeHead(500, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: false,
        message: "Failed to submit vehicle"
      }));
    }

    return true;
  }

  // ADMIN: Get pending vehicles
  if (
    req.method === "GET" &&
    url.pathname === "/api/admin/vehicles/pending"
  ) {
    try {
      const auth = authenticateUser(req);

      if (!auth.success) {
        res.writeHead(auth.status, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: auth.message
        }));
        return true;
      }

      const permission = authorizeRoles(auth.user, ["admin"]);

      if (!permission.success) {
        res.writeHead(permission.status, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: permission.message
        }));
        return true;
      }

      const db = getDB();

      const vehicles = await db.collection("vehicles")
        .find({ status: "pending" })
        .sort({ createdAt: -1 })
        .toArray();

      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: true,
        count: vehicles.length,
        vehicles
      }));

    } catch (error) {
      console.error("Admin pending vehicles error:", error);

      res.writeHead(500, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: false,
        message: "Failed to fetch pending vehicles"
      }));
    }

    return true;
  }

  // ADMIN: Approve or reject vehicle
  const statusMatch = url.pathname.match(
    /^\/api\/admin\/vehicles\/([a-f\d]{24})\/status$/i
  );

  if (req.method === "PATCH" && statusMatch) {
    try {
      const auth = authenticateUser(req);

      if (!auth.success) {
        res.writeHead(auth.status, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: auth.message
        }));
        return true;
      }

      const permission = authorizeRoles(auth.user, ["admin"]);

      if (!permission.success) {
        res.writeHead(permission.status, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: permission.message
        }));
        return true;
      }

      const { status } = body;

      if (!["approved", "rejected"].includes(status)) {
        res.writeHead(400, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: "Status must be approved or rejected"
        }));
        return true;
      }

      const db = getDB();
      const vehicleId = new ObjectId(statusMatch[1]);

      const result = await db.collection("vehicles").updateOne(
        {
          _id: vehicleId,
          status: "pending"
        },
        {
          $set: {
            status,
            updatedAt: new Date(),
            reviewedBy: auth.user.userId
          }
        }
      );

      if (result.matchedCount === 0) {
        res.writeHead(404, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: "Pending vehicle not found"
        }));
        return true;
      }

      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: true,
        message: `Vehicle ${status} successfully`
      }));

    } catch (error) {
      console.error("Admin vehicle approval error:", error);

      res.writeHead(500, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: false,
        message: "Failed to update vehicle status"
      }));
    }

    return true;
  }

  // OWNER: Get own vehicle listings
  if (
    req.method === "GET" &&
    url.pathname === "/api/owner/vehicles"
  ) {
    try {
      const auth = authenticateUser(req);

      if (!auth.success) {
        res.writeHead(auth.status, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: auth.message
        }));
        return true;
      }

      const permission = authorizeRoles(auth.user, ["owner"]);

      if (!permission.success) {
        res.writeHead(permission.status, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: permission.message
        }));
        return true;
      }

      const db = getDB();

      const vehicles = await db.collection("vehicles")
        .find({ ownerId: auth.user.userId })
        .sort({ createdAt: -1 })
        .toArray();

      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: true,
        count: vehicles.length,
        vehicles
      }));

    } catch (error) {
      console.error("Owner vehicles error:", error);

      res.writeHead(500, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: false,
        message: "Failed to fetch your vehicle listings"
      }));
    }

    return true;
  }

  // ADMIN: Delete vehicle
  const deleteMatch = url.pathname.match(
    /^\/api\/admin\/vehicles\/([a-f\d]{24})$/i
  );

  if (req.method === "DELETE" && deleteMatch) {
    try {
      const auth = authenticateUser(req);

      if (!auth.success) {
        res.writeHead(auth.status, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: auth.message
        }));
        return true;
      }

      const permission = authorizeRoles(auth.user, ["admin"]);

      if (!permission.success) {
        res.writeHead(permission.status, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: permission.message
        }));
        return true;
      }

      const db = getDB();
      const vehicleId = new ObjectId(deleteMatch[1]);

      const vehicle = await db.collection("vehicles").findOne({
        _id: vehicleId
      });

      if (!vehicle) {
        res.writeHead(404, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: "Vehicle listing not found"
        }));
        return true;
      }

      const result = await db.collection("vehicles").deleteOne({
        _id: vehicleId
      });

      if (result.deletedCount !== 1) {
        res.writeHead(500, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({
          success: false,
          message: "Vehicle could not be deleted"
        }));
        return true;
      }

      try {
        await db.collection("deletedVehicles").insertOne({
          vehicleId: vehicle._id,
          vehicle,
          deletedBy: auth.user.userId,
          deletedAt: new Date()
        });
      } catch (auditError) {
        console.error("Vehicle deletion audit error:", auditError);
      }

      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: true,
        message: "Vehicle listing deleted successfully"
      }));

    } catch (error) {
      console.error("Admin delete vehicle error:", error);

      res.writeHead(500, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: false,
        message: "Failed to delete vehicle"
      }));
    }

    return true;
  }

  return false;
};