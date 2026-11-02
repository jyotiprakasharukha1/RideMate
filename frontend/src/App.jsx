
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import LiveFleetMap from "./LiveFleetMap";

const formatPrice = (price) =>
  `₹${price.toLocaleString("en-IN")}`;

const ownerInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  borderRadius: 8,
  border: "1px solid #344554",
  background: "#0b141c",
  color: "#f5f5f5",
  font: "inherit"
};

function App() {
  const [category, setCategory] = useState("All");
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState("20");
  const [searchApplied, setSearchApplied] = useState(false);
  const [marketplaceVehicles, setMarketplaceVehicles] = useState([]);
  const [favoriteVehicleIds, setFavoriteVehicleIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ridemate_favorites") || "[]"); } catch { return []; }
  });
  const [compareVehicleIds, setCompareVehicleIds] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [filterBrand, setFilterBrand] = useState("All");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortOrder, setSortOrder] = useState("recommended");
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [marketplaceError, setMarketplaceError] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [customerBookings, setCustomerBookings] = useState([]);
  const [bookingError, setBookingError] = useState("");
  const [bookingNotice, setBookingNotice] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [bookingStartDate, setBookingStartDate] = useState("");
  const [bookingEndDate, setBookingEndDate] = useState("");
  const [showDemoPayment, setShowDemoPayment] = useState(false);
  const [demoPaymentMethod, setDemoPaymentMethod] = useState("upi");
  const [demoPaymentComplete, setDemoPaymentComplete] = useState(false);
  
  const [authView, setAuthView] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [showCustomerDashboard, setShowCustomerDashboard] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showOwnerDashboard, setShowOwnerDashboard] = useState(false);
  const [ownerVehicles, setOwnerVehicles] = useState([]);
  const [ownerActiveBookings, setOwnerActiveBookings] = useState([]);
  const [trackingBookingId, setTrackingBookingId] = useState(null);
  const [trackingStatus, setTrackingStatus] = useState("");
  const [trackingError, setTrackingError] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [customerTrackingLocations, setCustomerTrackingLocations] = useState({});
  const [customerTrackingErrors, setCustomerTrackingErrors] = useState({});
  const [customerGpsSharing, setCustomerGpsSharing] = useState({});
  const [customerGpsStatus, setCustomerGpsStatus] = useState({});
  const customerWatchRefs = useRef({});
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerSubmitting, setOwnerSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const [ownerNotice, setOwnerNotice] = useState("");
  const [ownerPhotos, setOwnerPhotos] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const trackingWatchRef = useRef(null);
  const photoInputRef = useRef(null);
  const [ownerForm, setOwnerForm] = useState({
    type: "car",
    brand: "",
    model: "",
    year: "",
    pricePerDay: "",
    location: "",
    description: "",
    images: ""
  });
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const openLiveCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera is not available in this browser. Use Choose Photos instead.");
      setCameraOpen(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      setCameraStream(stream);
      setCameraOpen(true);
    } catch (error) {
      setCameraError(
        error.name === "NotAllowedError"
          ? "Camera permission was blocked. Allow camera access in your browser settings and try again."
          : error.name === "NotFoundError"
          ? "No camera was found. Connect a webcam or use Choose Photos."
          : "Could not start the camera. Check that another app is not using it."
      );
      setCameraOpen(true);
    }
  };

  const closeLiveCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setCameraOpen(false);
  };

  const compressPhoto = (source, fileName = "vehicle-photo.jpg") => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 720;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({
        name: fileName,
        dataUrl: canvas.toDataURL("image/jpeg", 0.45)
      });
    };
    image.onerror = reject;
    image.src = source;
  });

  const handlePhotoFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    const remaining = 5 - ownerPhotos.length;
    if (files.length > remaining) {
      setOwnerError("You can add up to 5 vehicle photos.");
    }
    const selected = files.slice(0, Math.max(0, remaining));
    try {
      const compressed = await Promise.all(selected.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try { resolve(await compressPhoto(reader.result, file.name)); }
          catch (error) { reject(error); }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })));
      const combined = [...ownerPhotos, ...compressed].slice(0, 5);
      const estimatedBytes = combined.reduce((total, photo) => total + Math.ceil(photo.dataUrl.length * 0.75), 0);
      if (estimatedBytes > 650 * 1024) {
        setOwnerError("These photos are too large to submit together. Choose fewer or smaller photos (maximum 5). ");
        return;
      }
      setOwnerPhotos(combined);
      setOwnerError("");
    } catch {
      setOwnerError("One or more photos could not be loaded. Try a JPG or PNG image.");
    }
    event.target.value = "";
  };

  const captureCameraPhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCameraError("Camera is still starting. Please wait a moment and try again.");
      return;
    }
    if (ownerPhotos.length >= 5) {
      setCameraError("You can add up to 5 vehicle photos.");
      return;
    }
    const canvas = document.createElement("canvas");
    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const photo = {
      name: `vehicle-photo-${Date.now()}.jpg`,
      dataUrl: canvas.toDataURL("image/jpeg", 0.45)
    };
    const combined = [...ownerPhotos, photo].slice(0, 5);
    const estimatedBytes = combined.reduce((total, item) => total + Math.ceil(item.dataUrl.length * 0.75), 0);
    if (estimatedBytes > 650 * 1024) {
      setCameraError("Photo storage limit reached. Remove a photo or capture a smaller image.");
      return;
    }
    setOwnerPhotos(combined);
    setCameraError("");
  };

  const [adminVehicles, setAdminVehicles] = useState([]);
  const [adminApprovedCount, setAdminApprovedCount] = useState(0);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminActionId, setAdminActionId] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminNotice, setAdminNotice] = useState("");

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    role: "customer"
  });
  const [authOtp, setAuthOtp] = useState("");
  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: "",
    confirmPassword: ""
  });
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setOtpCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpCooldown > 0]);

  const loadApprovedVehicles = async () => {
    setMarketplaceLoading(true);
    setMarketplaceError("");

    try {
      const query = new URLSearchParams();
      if (filterStartDate && filterEndDate) { query.set("startDate", filterStartDate); query.set("endDate", filterEndDate); }
      const response = await fetch(`https://76kdktfr-5000.inc1.devtunnels.ms/api/vehicles${query.toString() ? `?${query}` : ""}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load available vehicles.");
      }

      const liveVehicles = (data.vehicles || []).map((vehicle) => ({
        ...vehicle,
        id: vehicle._id,
        _id: vehicle._id,
        year: vehicle.year || "",
        description: vehicle.description || "",
        images: Array.isArray(vehicle.images) ? vehicle.images : [],
        name: `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() || "RideMate vehicle",
        type: vehicle.type === "bike" ? "Bike" : "Car",
        price: Number(vehicle.pricePerDay || 0),
        location: vehicle.location || "Location not provided",
        image: Array.isArray(vehicle.images) ? vehicle.images[0] : "",
        details: vehicle.description || (vehicle.year ? `Model year ${vehicle.year}` : "Owner-listed vehicle"),
        tag: "APPROVED"
      }));

      setMarketplaceVehicles(liveVehicles);
    } catch (error) {
      setMarketplaceError(error.message || "Could not connect to the vehicle marketplace.");
    } finally {
      setMarketplaceLoading(false);
    }
  };

  useEffect(() => {
    loadApprovedVehicles();
  }, []);

  const loadAdminDashboard = async () => {
    const token = sessionStorage.getItem("ridemate_token");
    if (!token) {
      setAdminError("Your session has expired. Please log in again.");
      return;
    }

    setAdminLoading(true);
    setAdminError("");

    try {
      const [pendingResponse, approvedResponse] = await Promise.all([
        fetch("https://76kdktfr-5000.inc1.devtunnels.ms/api/admin/vehicles/pending", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("https://76kdktfr-5000.inc1.devtunnels.ms/api/vehicles")
      ]);
      const pendingData = await pendingResponse.json();
      const approvedData = await approvedResponse.json();

      if (!pendingResponse.ok || !pendingData.success) {
        throw new Error(pendingData.message || "Could not load pending vehicles.");
      }

      const pendingVehicles = (pendingData.vehicles || []).map((vehicle) => ({
        ...vehicle,
        status: vehicle.status || "pending"
      }));
      const approvedVehicles =
        approvedResponse.ok && approvedData.success
          ? (approvedData.vehicles || []).map((vehicle) => ({
              ...vehicle,
              status: vehicle.status || "approved"
            }))
          : [];

      const combinedVehicles = [
        ...pendingVehicles,
        ...approvedVehicles.filter(
          (approved) =>
            !pendingVehicles.some(
              (pending) => String(pending._id) === String(approved._id)
            )
        )
      ];

      setAdminVehicles(combinedVehicles);
      setAdminApprovedCount(approvedVehicles.length);
    } catch (error) {
      setAdminError(error.message || "Could not load the admin dashboard.");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminVehicleStatus = async (vehicleId, status) => {
    const token = sessionStorage.getItem("ridemate_token");
    if (!token) {
      setAdminError("Your session has expired. Please log in again.");
      return;
    }

    setAdminActionId(vehicleId);
    setAdminError("");
    setAdminNotice("");

    try {
      const response = await fetch(
        `https://76kdktfr-5000.inc1.devtunnels.ms/api/admin/vehicles/${vehicleId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status })
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || `Could not ${status} this vehicle.`);
      }

      setAdminVehicles((current) =>
        current.map((vehicle) =>
          String(vehicle._id) === String(vehicleId)
            ? { ...vehicle, status }
            : vehicle
        )
      );
      if (status === "approved") {
        setAdminApprovedCount((count) => count + 1);
      }
      setAdminNotice(data.message || `Vehicle ${status} successfully.`);
    } catch (error) {
      setAdminError(error.message || "Vehicle status update failed.");
    } finally {
      setAdminActionId("");
    }
  };

  const handleAdminVehicleDelete = async (vehicle) => {
    const vehicleName = `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() || "this vehicle";
    const confirmed = window.confirm(
      `Permanently delete ${vehicleName}? This cannot be undone.`
    );

    if (!confirmed) return;

    const token = sessionStorage.getItem("ridemate_token");
    if (!token) {
      setAdminError("Your session has expired. Please log in again.");
      return;
    }

    setAdminActionId(String(vehicle._id));
    setAdminError("");
    setAdminNotice("");

    try {
      const response = await fetch(
        `https://76kdktfr-5000.inc1.devtunnels.ms/api/admin/vehicles/${vehicle._id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not delete this vehicle.");
      }

      setAdminVehicles((current) =>
        current.filter(
          (item) => String(item._id) !== String(vehicle._id)
        )
      );

      if (vehicle.status === "approved") {
        setAdminApprovedCount((count) => Math.max(0, count - 1));
      }

      setAdminNotice(data.message || "Vehicle deleted successfully.");
      await loadApprovedVehicles();
    } catch (error) {
      setAdminError(error.message || "Vehicle deletion failed.");
    } finally {
      setAdminActionId("");
    }
  };

  const loadOwnerDashboard = async () => {
    const token = sessionStorage.getItem("ridemate_token");
    if (!token) {
      setOwnerError("Your session has expired. Please log in again.");
      return;
    }

    setOwnerLoading(true);
    setOwnerError("");

    try {
      const response = await fetch("https://76kdktfr-5000.inc1.devtunnels.ms/api/owner/vehicles", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load your vehicle listings.");
      }
      setOwnerVehicles(data.vehicles || []);
    } catch (error) {
      setOwnerError(error.message || "Could not load your owner dashboard.");
    } finally {
      setOwnerLoading(false);
    }
  };
  const loadOwnerActiveBookings = async () => {
    const token = sessionStorage.getItem("ridemate_token");
    if (!token) return;
    try {
      const response = await fetch("https://76kdktfr-5000.inc1.devtunnels.ms/api/tracking/owner/fleet", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not load fleet bookings.");
      setOwnerActiveBookings(data.bookings || []);
      setTrackingError("");
    } catch (error) {
      setTrackingError(error.message || "Could not load live fleet.");
    }
  };

  // Owner activates the rental. The CUSTOMER's phone will share GPS after consent.
  const startVehicleTracking = async (bookingId) => {
    const token = sessionStorage.getItem("ridemate_token");
    if (!token) { setTrackingError("Please log in again."); return; }
    setTrackingLoading(true);
    setTrackingError("");
    try {
      const response = await fetch(`https://76kdktfr-5000.inc1.devtunnels.ms/api/tracking/${bookingId}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not activate rental.");
      setTrackingStatus("Rental activated. Ask the customer to open their RideMate account and enable GPS sharing.");
      await loadOwnerActiveBookings();
      await loadOwnerDashboard();
    } catch (error) {
      setTrackingError(error.message || "Could not activate rental.");
    } finally {
      setTrackingLoading(false);
    }
  };

  const stopVehicleTracking = async (bookingId) => {
    const token = sessionStorage.getItem("ridemate_token");
    if (!token || !window.confirm("Complete this rental and disable customer GPS tracking?")) return;
    setTrackingLoading(true);
    setTrackingError("");
    try {
      const response = await fetch(`https://76kdktfr-5000.inc1.devtunnels.ms/api/tracking/${bookingId}/stop`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not complete rental.");
      setTrackingStatus("Rental completed. Customer GPS tracking is disabled.");
      await loadOwnerActiveBookings();
      await loadOwnerDashboard();
    } catch (error) {
      setTrackingError(error.message || "Could not complete rental.");
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleOwnerFormChange = (e) => {
    const { name, value } = e.target;
    setOwnerForm((current) => ({ ...current, [name]: value }));
  };

  const captureOwnerLocation = () => {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("GPS is not supported by this browser.");
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationLoading(false);
        setOwnerNotice("Pickup GPS location captured successfully.");
      },
      (error) => {
        let message = "Unable to get your location.";

        if (error.code === error.PERMISSION_DENIED) {
          message = "Location permission denied. Allow location access in your browser.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Your current location is unavailable.";
        } else if (error.code === error.TIMEOUT) {
          message = "Location request timed out. Please try again.";
        }

        setLocationError(message);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const handleOwnerVehicleSubmit = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem("ridemate_token");
    if (!token) {
      setOwnerError("Your session has expired. Please log in again.");
      return;
    }

    setOwnerSubmitting(true);
    setOwnerError("");
    setOwnerNotice("");

    try {
      const payload = {
        type: ownerForm.type,
        brand: ownerForm.brand.trim(),
        model: ownerForm.model.trim(),
        year: ownerForm.year ? Number(ownerForm.year) : null,
        pricePerDay: Number(ownerForm.pricePerDay),
        location: ownerForm.location.trim(),
        latitude: gpsCoordinates?.latitude ?? null,
        longitude: gpsCoordinates?.longitude ?? null,
        description: ownerForm.description.trim(),
        images: ownerPhotos.map((photo) => photo.dataUrl)
      };

      const response = await fetch("https://76kdktfr-5000.inc1.devtunnels.ms/api/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not submit your vehicle.");
      }

      setOwnerNotice("Vehicle submitted. It will appear in the marketplace after admin approval.");
      setOwnerPhotos([]);
      setGpsCoordinates(null);
      setLocationError("");
      setOwnerForm({
        type: "car", brand: "", model: "", year: "", pricePerDay: "",
        location: "", description: "", images: ""
      });
      await loadOwnerDashboard();
    } catch (error) {
      setOwnerError(error.message || "Vehicle submission failed.");
    } finally {
      setOwnerSubmitting(false);
    }
  };

  const loadCustomerBookings = async () => {
    const token = sessionStorage.getItem("ridemate_token");
    if (!token) return;
    try {
      const response = await fetch("https://76kdktfr-5000.inc1.devtunnels.ms/api/bookings/my", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not load bookings.");
      setCustomerBookings(data.bookings || []);
    } catch (error) { setBookingError(error.message); }
  };


  const loadCustomerTrackingLocation = async (bookingId) => {
    const token = sessionStorage.getItem("ridemate_token");
    if (!token) return;
    try {
      const response = await fetch(`https://76kdktfr-5000.inc1.devtunnels.ms/api/tracking/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Tracking is not available.");
      setCustomerTrackingLocations((current) => ({ ...current, [bookingId]: { location: data.location, trail: data.trail || [], destination: data.destination || null } }));
      setCustomerTrackingErrors((current) => ({ ...current, [bookingId]: "" }));
    } catch (error) {
      setCustomerTrackingErrors((current) => ({ ...current, [bookingId]: error.message }));
    }
  };

  const startCustomerGpsSharing = async (bookingId) => {
    if (!navigator.geolocation) {
      setCustomerTrackingErrors((current) => ({
        ...current,
        [bookingId]: "GPS is not supported by this browser."
      }));
      return;
    }

    if (customerWatchRefs.current[bookingId] !== undefined) return;

    const token = sessionStorage.getItem("ridemate_token");

    if (!token) {
      setCustomerTrackingErrors((current) => ({
        ...current,
        [bookingId]: "Please log in again."
      }));
      return;
    }

    setCustomerTrackingErrors((current) => ({
      ...current,
      [bookingId]: ""
    }));

    setCustomerGpsStatus((current) => ({
      ...current,
      [bookingId]: "Requesting location permission..."
    }));

    try {
      // Record the customer's consent on the server before sending GPS data.
      const consentResponse = await fetch(
        `https://76kdktfr-5000.inc1.devtunnels.ms/api/tracking/${bookingId}/consent`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const consentData = await consentResponse.json();

      if (!consentResponse.ok || !consentData.success) {
        throw new Error(
          consentData.message || "Could not enable GPS sharing."
        );
      }

      setCustomerGpsStatus((current) => ({
        ...current,
        [bookingId]: "Consent recorded. Waiting for GPS permission..."
      }));

      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          try {
            const payload = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            };

            const response = await fetch(
              `https://76kdktfr-5000.inc1.devtunnels.ms/api/tracking/${bookingId}/location`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
              }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
              throw new Error(data.message || "GPS update failed.");
            }

            setCustomerGpsSharing((current) => ({
              ...current,
              [bookingId]: true
            }));

            setCustomerGpsStatus((current) => ({
              ...current,
              [bookingId]: `Sharing live location · ±${Math.round(position.coords.accuracy)} m`
            }));

            await loadCustomerTrackingLocation(bookingId);
          } catch (error) {
            setCustomerTrackingErrors((current) => ({
              ...current,
              [bookingId]: error.message
            }));

            const message = error.message.toLowerCase();

            if (
              message.includes("paused") ||
              message.includes("ended") ||
              message.includes("not enabled")
            ) {
              stopCustomerGpsSharing(bookingId, false);
            }
          }
        },
        (error) => {
          const message = error.code === error.PERMISSION_DENIED
            ? "Location permission denied. Allow location access in browser settings."
            : "Could not read GPS. Check your device location settings.";

          setCustomerTrackingErrors((current) => ({
            ...current,
            [bookingId]: message
          }));

          setCustomerGpsStatus((current) => ({
            ...current,
            [bookingId]: "GPS sharing is off"
          }));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 20000
        }
      );

      customerWatchRefs.current[bookingId] = watchId;
    } catch (error) {
      setCustomerTrackingErrors((current) => ({
        ...current,
        [bookingId]: error.message
      }));

      setCustomerGpsStatus((current) => ({
        ...current,
        [bookingId]: "GPS sharing is off"
      }));
    }
  };

  const stopCustomerGpsSharing = async (bookingId, updateServer = true) => {
    // Stop browser GPS immediately.
    const watchId = customerWatchRefs.current[bookingId];

    if (watchId !== undefined) {
      navigator.geolocation?.clearWatch(watchId);
      delete customerWatchRefs.current[bookingId];
    }

    setCustomerGpsSharing((current) => ({
      ...current,
      [bookingId]: false
    }));

    if (!updateServer) return;

    const token = sessionStorage.getItem("ridemate_token");

    try {
      const response = await fetch(
        `https://76kdktfr-5000.inc1.devtunnels.ms/api/tracking/${bookingId}/pause`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not pause GPS sharing.");
      }

      setCustomerGpsStatus((current) => ({
        ...current,
        [bookingId]: "GPS sharing paused"
      }));

      await loadCustomerTrackingLocation(bookingId);
    } catch (error) {
      setCustomerTrackingErrors((current) => ({
        ...current,
        [bookingId]: error.message
      }));
    }
  };

  const saveCustomerDestination = async (bookingId, destination) => {
    const token = sessionStorage.getItem("ridemate_token");
    try {
      const response = await fetch(`https://76kdktfr-5000.inc1.devtunnels.ms/api/tracking/${bookingId}/destination`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(destination)
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not save destination.");
      await loadCustomerTrackingLocation(bookingId);
      setBookingNotice("Destination saved. The planned route is now visible on the live map.");
    } catch (error) {
      setCustomerTrackingErrors((current) => ({ ...current, [bookingId]: error.message }));
    }
  };

  useEffect(() => {
    if (!showCustomerDashboard || authenticatedUser?.role !== "customer") return;
    const refresh = () => loadCustomerBookings();
    refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => window.clearInterval(timer);
  }, [showCustomerDashboard, authenticatedUser?.role]);

  useEffect(() => {
    if (!showCustomerDashboard || authenticatedUser?.role !== "customer") return;
    const activeIds = customerBookings.filter((booking) => booking.status === "active" && booking.trackingActive !== false).map((booking) => booking._id);
    if (!activeIds.length) return;
    activeIds.forEach(loadCustomerTrackingLocation);
    const timer = window.setInterval(() => activeIds.forEach(loadCustomerTrackingLocation), 5000);
    return () => window.clearInterval(timer);
  }, [showCustomerDashboard, authenticatedUser?.role, customerBookings]);

  useEffect(() => {
    if (!showOwnerDashboard || authenticatedUser?.role !== "owner") return;
    loadOwnerActiveBookings();
    const timer = window.setInterval(loadOwnerActiveBookings, 5000);
    return () => window.clearInterval(timer);
  }, [showOwnerDashboard, authenticatedUser?.role]);

  useEffect(() => () => {
    Object.values(customerWatchRefs.current).forEach((watchId) => navigator.geolocation?.clearWatch(watchId));
    customerWatchRefs.current = {};
  }, []);

  const confirmVehicleBooking = async () => {
    const token = sessionStorage.getItem("ridemate_token");
    if (!token) { setAuthView("login"); setAuthMessage("Please log in as a customer to confirm this booking."); return; }
    if (authenticatedUser?.role !== "customer") { setBookingError("Only customer accounts can book vehicles."); return; }
    setBookingSubmitting(true); setBookingError(""); setBookingNotice("");
    try {
      const response = await fetch("https://76kdktfr-5000.inc1.devtunnels.ms/api/bookings", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vehicleId: selectedVehicle.id, startDate: bookingStartDate, endDate: bookingEndDate })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Booking failed.");
      setDemoPaymentComplete(true);
      setBookingNotice("Booking confirmed and saved to MongoDB.");
      await loadCustomerBookings();
      await loadApprovedVehicles();
    } catch (error) { setBookingError(error.message); }
    finally { setBookingSubmitting(false); }
  };

  const cancelCustomerBooking = async (bookingId) => {
    const token = sessionStorage.getItem("ridemate_token");
    if (!token || !window.confirm("Cancel this booking?")) return;
    setBookingError(""); setBookingNotice("");
    try {
      const response = await fetch(`https://76kdktfr-5000.inc1.devtunnels.ms/api/bookings/${bookingId}/cancel`, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Cancellation failed.");
      setBookingNotice(data.message);
      await loadCustomerBookings();
      await loadApprovedVehicles();
    } catch (error) { setBookingError(error.message); }
  };

  const handleAuthChange = (e) => {
    const { name, value } = e.target;

    setAuthForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const postAuthRequest = async (path, payload) => {
    const response = await fetch(`https://76kdktfr-5000.inc1.devtunnels.ms/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Authentication request failed.");
    }
    return data;
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (authView === "register") {
      if (authForm.password !== authForm.confirmPassword) {
        setAuthError("Passwords do not match.");
        return;
      }
      if (authForm.mobile.trim().length < 10) {
        setAuthError("Enter a valid mobile number.");
        return;
      }
    }

    if ((authView === "verify-registration-otp" || authView === "verify-reset-otp") && !/^\d{6}$/.test(authOtp)) {
      setAuthError("Enter the 6-digit OTP.");
      return;
    }

    if (authView === "reset-password") {
      if (resetPasswordForm.newPassword.length < 8) {
        setAuthError("Password must contain at least 8 characters.");
        return;
      }
      if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
        setAuthError("Passwords do not match.");
        return;
      }
    }

    setAuthLoading(true);
    try {
      if (authView === "register") {
        const data = await postAuthRequest("register", {
          name: authForm.name.trim(),
          email: authForm.email.trim().toLowerCase(),
          mobile: authForm.mobile.trim(),
          password: authForm.password,
          role: authForm.role
        });
        setAuthView("verify-registration-otp");
        setAuthOtp("");
        setOtpCooldown(60);
        setAuthMessage(data.message || "OTP sent to your email. Enter it below to complete registration.");
        return;
      }

      if (authView === "verify-registration-otp") {
        const data = await postAuthRequest("verify-otp", {
          email: authForm.email.trim().toLowerCase(),
          otp: authOtp.trim()
        });
        setAuthView("login");
        setAuthOtp("");
        setAuthForm((previous) => ({ ...previous, password: "", confirmPassword: "" }));
        setAuthMessage(data.message || "Email verified. Registration successful. Please log in.");
        return;
      }

      if (authView === "forgot-password") {
        const data = await postAuthRequest("forgot-password", {
          email: authForm.email.trim().toLowerCase()
        });
        setAuthView("verify-reset-otp");
        setAuthOtp("");
        setOtpCooldown(60);
        setAuthMessage(data.message || "If the account exists, a password reset OTP has been sent.");
        return;
      }

      if (authView === "verify-reset-otp") {
        const data = await postAuthRequest("verify-reset-otp", {
          email: authForm.email.trim().toLowerCase(),
          otp: authOtp.trim()
        });
        setAuthView("reset-password");
        setAuthMessage(data.message || "OTP verified. Set your new password.");
        return;
      }

      if (authView === "reset-password") {
        await postAuthRequest("reset-password", {
          email: authForm.email.trim().toLowerCase(),
          newPassword: resetPasswordForm.newPassword
        });
        setAuthView("login");
        setAuthOtp("");
        setResetPasswordForm({ newPassword: "", confirmPassword: "" });
        setAuthForm((previous) => ({ ...previous, password: "" }));
        setAuthMessage("Password reset successful. Please log in with your new password.");
        return;
      }

      const data = await postAuthRequest("login", {
        email: authForm.email.trim().toLowerCase(),
        password: authForm.password
      });

      if (!data.token || !data.user) {
        throw new Error("Login response is incomplete.");
      }

      sessionStorage.setItem("ridemate_token", data.token);
      setAuthenticatedUser(data.user);
      setShowCustomerDashboard(data.user.role === "customer");
      if (data.user.role === "customer") loadCustomerBookings();
      setShowAdminDashboard(data.user.role === "admin");
      setShowOwnerDashboard(data.user.role === "owner");
      setAuthView(null);
      if (data.user.role === "admin") loadAdminDashboard();
      if (data.user.role === "owner") {
        loadOwnerDashboard();
        loadOwnerActiveBookings();
      }
    } catch (error) {
      setAuthError(error.message === "Failed to fetch"
        ? "Cannot connect to RideMate server. Check your backend."
        : error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendAuthOtp = async () => {
    setAuthError("");
    setAuthMessage("");
    setAuthLoading(true);
    try {
      const path = authView === "verify-registration-otp" ? "resend-otp" : "forgot-password";
      const data = await postAuthRequest(path, { email: authForm.email.trim().toLowerCase() });
      setOtpCooldown(60);
      setAuthMessage(data.message || "OTP request processed. Check your email.");
    } catch (error) {
      setAuthError(error.message || "Could not resend OTP.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Restore the current session after a page refresh by validating the stored JWT.
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const token = sessionStorage.getItem("ridemate_token");

      if (!token) {
        if (!cancelled) setSessionChecking(false);
        return;
      }

      try {
        const response = await fetch("https://76kdktfr-5000.inc1.devtunnels.ms/api/auth/profile", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();

        if (!response.ok || !data.success || !data.user) {
          throw new Error(data.message || "Your session is no longer valid.");
        }

        if (cancelled) return;

        setAuthenticatedUser(data.user);
        setShowCustomerDashboard(data.user.role === "customer");
        setShowOwnerDashboard(data.user.role === "owner");
        setShowAdminDashboard(data.user.role === "admin");

        if (data.user.role === "customer") {
          await loadCustomerBookings();
        } else if (data.user.role === "owner") {
          await Promise.all([loadOwnerDashboard(), loadOwnerActiveBookings()]);
        } else if (data.user.role === "admin") {
          await loadAdminDashboard();
        }
      } catch (error) {
        if (!cancelled) {
          sessionStorage.removeItem("ridemate_token");
          setAuthenticatedUser(null);
          setShowCustomerDashboard(false);
          setShowOwnerDashboard(false);
          setShowAdminDashboard(false);
          setAuthMessage("Your session expired. Please log in again.");
        }
      } finally {
        if (!cancelled) setSessionChecking(false);
      }
    };

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("ridemate_token");
    setAuthenticatedUser(null);
    setShowCustomerDashboard(false);
    setShowAdminDashboard(false);
    setShowOwnerDashboard(false);
    setOwnerVehicles([]);
    setAdminVehicles([]);
    setAdminError("");
    setAdminNotice("");
    setAuthView(null);
    setAuthMessage("");
  };


  useEffect(() => {
    localStorage.setItem("ridemate_favorites", JSON.stringify(favoriteVehicleIds));
  }, [favoriteVehicleIds]);

  const toggleFavorite = (vehicleId) => {
    const id = String(vehicleId);
    setFavoriteVehicleIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleCompare = (vehicleId) => {
    const id = String(vehicleId);
    setCompareVehicleIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 3 ? current : [...current, id]);
  };

  const filteredVehicles = useMemo(() => {
    const results = marketplaceVehicles.filter((vehicle) => {
      const matchesCategory =
        category === "All" || vehicle.type === category;

      const matchesLocation =
        !searchApplied ||
        !location.trim() ||
        vehicle.location.toLowerCase().includes(location.trim().toLowerCase());

      const matchesBrand = filterBrand === "All" || (vehicle.brand || "").toLowerCase() === filterBrand.toLowerCase();
      const matchesMin = minPrice === "" || Number(vehicle.price) >= Number(minPrice);
      const matchesMax = maxPrice === "" || Number(vehicle.price) <= Number(maxPrice);
      const matchesFavorite = !showFavoritesOnly || favoriteVehicleIds.includes(String(vehicle.id));
      return matchesCategory && matchesLocation && matchesBrand && matchesMin && matchesMax && matchesFavorite;
    });
    if (sortOrder === "price-low") results.sort((a, b) => a.price - b.price);
    if (sortOrder === "price-high") results.sort((a, b) => b.price - a.price);
    if (sortOrder === "name") results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }, [marketplaceVehicles, category, location, searchApplied, filterBrand, minPrice, maxPrice, showFavoritesOnly, favoriteVehicleIds, sortOrder]);

  const compareVehicles = marketplaceVehicles.filter((vehicle) => compareVehicleIds.includes(String(vehicle.id)));
  const availableBrands = [...new Set(marketplaceVehicles.map((vehicle) => vehicle.brand).filter(Boolean))].sort();

  const scrollToVehicles = () => {
    document.getElementById("vehicles")?.scrollIntoView({
      behavior: "smooth",
    });
  };

  const chooseCategory = (type) => {
    setCategory(type);
    setSearchApplied(false);
    scrollToVehicles();
  };

  return (
    <div className="app">
      {/* NAVIGATION */}
      <header className="navbar">
        <a href="#home" className="logo">
          Ride<span>Mate</span><i>.</i>
        </a>

        <nav className="nav-links">
          <a href="#home" className="nav-active" onClick={() => setShowCustomerDashboard(false)}>Home</a>
          <a href="#vehicles" onClick={() => setShowCustomerDashboard(false)}>Explore</a>
          <a href="#how-it-works" onClick={() => setShowCustomerDashboard(false)}>How It Works</a>
          <a href="#owner" onClick={() => setShowCustomerDashboard(false)}>Become an Owner</a>
          {authenticatedUser?.role === "customer" && (
            <button
              type="button"
              className={showCustomerDashboard ? "nav-dashboard-btn active" : "nav-dashboard-btn"}
              onClick={() => {
                setShowAdminDashboard(false);
                setShowCustomerDashboard(true);
                loadCustomerBookings();
              }}
            >
              My Dashboard
            </button>
          )}
          {authenticatedUser?.role === "owner" && (
            <button
              type="button"
              className={showOwnerDashboard ? "nav-dashboard-btn active" : "nav-dashboard-btn"}
              onClick={() => {
                setShowCustomerDashboard(false);
                setShowAdminDashboard(false);
                setShowOwnerDashboard(true);
                loadOwnerDashboard();
                loadOwnerActiveBookings();
              }}
            >
              Owner Dashboard
            </button>
          )}
          {authenticatedUser?.role === "admin" && (
            <button
              type="button"
              className={showAdminDashboard ? "nav-dashboard-btn active" : "nav-dashboard-btn"}
              onClick={() => {
                setShowCustomerDashboard(false);
                setShowAdminDashboard(true);
                loadAdminDashboard();
              }}
            >
              Admin Dashboard
            </button>
          )}
        </nav>

        <div className="nav-actions">
          {sessionChecking ? (
            <span className="user-greeting">Checking session...</span>
          ) : authenticatedUser ? (
            <>
              <span className="user-greeting">
                Hi, {authenticatedUser.name}
              </span>
              <button className="login-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                className="login-btn"
                onClick={() => {
                  setAuthError("");
                  setAuthMessage("");
                  setAuthView("login");
                }}
              >
                Login
              </button>

              <button
                className="register-btn"
                onClick={() => {
                  setAuthError("");
                  setAuthMessage("");
                  setAuthView("register");
                }}
              >
                Get Started <span>↗</span>
              </button>
            </>
          )}
        </div>
      </header>

      {showAdminDashboard && authenticatedUser?.role === "admin" && (
        <section className="admin-dashboard" style={{maxWidth: 1240, margin: "0 auto", padding: "64px 5%", color: "#f5f5f5"}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap", marginBottom: 32}}>
            <div>
              <span className="eyebrow">RIDEMATE CONTROL CENTER</span>
              <h1 style={{fontSize: "clamp(32px, 5vw, 52px)", margin: "12px 0"}}>Admin <span>Dashboard.</span></h1>
              <p style={{color: "#aab3bd", margin: 0}}>Review owner listings and manage what appears in the marketplace.</p>
            </div>
            <button type="button" className="primary-btn" onClick={loadAdminDashboard} disabled={adminLoading}>
              {adminLoading ? "Refreshing..." : "Refresh listings ↻"}
            </button>
          </div>

          <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 32}}>
            <article style={{background: "#111c26", border: "1px solid #293847", borderRadius: 16, padding: 24}}>
              <span style={{color: "#aab3bd", fontSize: 12, letterSpacing: 1}}>PENDING REVIEW</span>
              <div style={{fontSize: 38, fontWeight: 700, margin: "8px 0"}}>{adminVehicles.length}</div>
              <span style={{color: "#aab3bd", fontSize: 13}}>Listings awaiting your decision</span>
            </article>
            <article style={{background: "#111c26", border: "1px solid #293847", borderRadius: 16, padding: 24}}>
              <span style={{color: "#aab3bd", fontSize: 12, letterSpacing: 1}}>APPROVED LISTINGS</span>
              <div style={{fontSize: 38, fontWeight: 700, margin: "8px 0"}}>{adminApprovedCount}</div>
              <span style={{color: "#aab3bd", fontSize: 13}}>Visible in the customer marketplace</span>
            </article>
          </div>

          {adminNotice && <div role="status" style={{padding: 14, marginBottom: 16, borderRadius: 10, background: "#123326", color: "#9ce7bd"}}>{adminNotice}</div>}
          {adminError && <div role="alert" style={{padding: 14, marginBottom: 16, borderRadius: 10, background: "#3a2020", color: "#ffb6b6"}}>{adminError}</div>}

          <section style={{background: "#111c26", border: "1px solid #293847", borderRadius: 18, padding: 24}}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 22}}>
              <div><span className="eyebrow">OWNER SUBMISSIONS</span><h2 style={{margin: "8px 0 0"}}>Pending vehicles</h2></div>
              <span style={{color: "#ff9b55"}}>{adminVehicles.length} waiting</span>
            </div>

            {adminLoading ? (
              <p style={{color: "#aab3bd"}}>Loading vehicle submissions...</p>
            ) : adminVehicles.length === 0 ? (
              <div style={{textAlign: "center", padding: "42px 16px", color: "#aab3bd"}}>
                <div style={{fontSize: 36, color: "#ff9b55"}}>✓</div>
                <h3 style={{color: "#f5f5f5"}}>All caught up</h3>
                <p>There are no vehicles waiting for approval right now.</p>
              </div>
            ) : (
              <div style={{display: "grid", gap: 18}}>
                {adminVehicles.map((vehicle) => (
                  <article key={vehicle._id} style={{display: "grid", gridTemplateColumns: "minmax(130px, 220px) 1fr", gap: 20, padding: 16, border: "1px solid #293847", borderRadius: 14}}>
                    <div style={{minHeight: 140, borderRadius: 10, overflow: "hidden", background: "#202d38", display: "grid", placeItems: "center"}}>
                      {vehicle.images?.[0] ? (
                        <img src={vehicle.images[0]} alt={`${vehicle.brand} ${vehicle.model}`} style={{width: "100%", height: "100%", minHeight: 140, objectFit: "cover"}} />
                      ) : <span style={{fontSize: 48}}>{vehicle.type === "bike" ? "🏍️" : "🚘"}</span>}
                    </div>
                    <div>
                      <div style={{display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap"}}>
                        <span style={{fontSize: 11, letterSpacing: 1, color: "#ff9b55"}}>{(vehicle.type || "vehicle").toUpperCase()}</span>
                        <span style={{fontSize: 11, color: vehicle.status === "approved" ? "#9ce7bd" : vehicle.status === "rejected" ? "#ffaaaa" : "#ffd18a"}}>{(vehicle.status || "pending").toUpperCase()}</span>
                      </div>
                      <h3 style={{fontSize: 23, margin: "8px 0"}}>{vehicle.brand} {vehicle.model}</h3>
                      <p style={{color: "#aab3bd", margin: "0 0 12px"}}>{vehicle.description || "No description provided."}</p>
                      <div style={{display: "flex", gap: 16, flexWrap: "wrap", color: "#c6ced6", fontSize: 13}}>
                        <span>⌖ {vehicle.location || "Location not provided"}</span>
                        <span>₹{Number(vehicle.pricePerDay || 0).toLocaleString("en-IN")} / day</span>
                        {vehicle.year && <span>{vehicle.year}</span>}
                      </div>
                      <p style={{fontSize: 11, color: "#778593", overflowWrap: "anywhere"}}>Listing ID: {vehicle._id}</p>
                      <div style={{display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14}}>
                        {vehicle.status === "pending" && (
                          <>
                            <button type="button" className="primary-btn" disabled={adminActionId === vehicle._id} onClick={() => handleAdminVehicleStatus(vehicle._id, "approved")}>
                              {adminActionId === vehicle._id ? "Please wait..." : "Approve"}
                            </button>
                            <button type="button" disabled={adminActionId === vehicle._id} onClick={() => handleAdminVehicleStatus(vehicle._id, "rejected")} style={{padding: "12px 20px", borderRadius: 8, border: "1px solid #a84a4a", background: "transparent", color: "#ffaaaa", cursor: "pointer"}}>
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          disabled={adminActionId === vehicle._id}
                          onClick={() => handleAdminVehicleDelete(vehicle)}
                          style={{padding: "12px 20px", borderRadius: 8, border: "1px solid #a84a4a", background: "#3a2020", color: "#ffb6b6", cursor: "pointer"}}
                        >
                          {adminActionId === vehicle._id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {showOwnerDashboard && authenticatedUser?.role === "owner" && (
        <section style={{ maxWidth: 1240, margin: "0 auto", padding: "64px 5%", color: "#f5f5f5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 30 }}>
            <div>
              <span className="eyebrow">OWNER SPACE</span>
              <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", margin: "12px 0" }}>Owner <span>Dashboard.</span></h1>
              <p style={{ color: "#aab3bd", margin: 0 }}>Add vehicles and track their review status.</p>
            </div>
            <button type="button" className="primary-btn" onClick={() => { loadOwnerDashboard(); loadOwnerActiveBookings(); }} disabled={ownerLoading || trackingLoading}>
              {ownerLoading || trackingLoading ? "Refreshing..." : "Refresh dashboard ↻"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            {["pending", "approved", "rejected"].map((status) => (
              <article key={status} style={{ background: "#111c26", border: "1px solid #293847", borderRadius: 14, padding: 22 }}>
                <span style={{ color: "#aab3bd", fontSize: 12, letterSpacing: 1 }}>{status.toUpperCase()}</span>
                <div style={{ fontSize: 36, fontWeight: 700, marginTop: 8 }}>{ownerVehicles.filter((v) => v.status === status).length}</div>
                <span style={{ color: "#aab3bd", fontSize: 13 }}>Your {status} listings</span>
              </article>
            ))}
          </div>

          <section className="rm-dashboard-analytics rm-owner-analytics">
            <div><span className="eyebrow">FLEET PERFORMANCE</span><h2>Interactive overview</h2><p>Based on the vehicle listings and rental records currently loaded.</p></div>
            <div className="rm-analytics-metrics"><article><strong>{ownerVehicles.length}</strong><span>Total vehicles</span></article><article><strong>{ownerActiveBookings.length}</strong><span>Confirmed / active rentals</span></article><article><strong>{ownerActiveBookings.filter((b) => b.status === "active").length}</strong><span>Currently active</span></article><article><strong>{ownerVehicles.filter((v) => v.status === "approved").length}</strong><span>Approved listings</span></article></div>
            <div className="rm-analytics-bars">{[{label:"Pending",count:ownerVehicles.filter((v) => v.status === "pending").length},{label:"Approved",count:ownerVehicles.filter((v) => v.status === "approved").length},{label:"Rejected",count:ownerVehicles.filter((v) => v.status === "rejected").length}].map((item) => <div className="rm-analytics-bar" key={item.label}><div className="rm-bar-track"><span style={{height:`${Math.max(5, item.count / Math.max(1, ownerVehicles.length) * 100)}%`}} /></div><strong>{item.count}</strong><small>{item.label}</small></div>)}</div>
          </section>

          {ownerNotice && <div role="status" style={{ padding: 14, marginBottom: 16, borderRadius: 10, background: "#123326", color: "#9ce7bd" }}>{ownerNotice}</div>}
          {ownerError && <div role="alert" style={{ padding: 14, marginBottom: 16, borderRadius: 10, background: "#3a2020", color: "#ffb6b6" }}>{ownerError}</div>}

          <section style={{ background: "#111c26", border: "1px solid #293847", borderRadius: 18, padding: 24, marginBottom: 24 }}>
            <span className="eyebrow">GROW WITH RIDEMATE</span>
            <h2 style={{ margin: "8px 0 22px" }}>Add a vehicle</h2>
            <form onSubmit={handleOwnerVehicleSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <label style={{ display: "grid", gap: 7, color: "#aab3bd", fontSize: 13 }}>Vehicle type
                <select name="type" value={ownerForm.type} onChange={handleOwnerFormChange} required style={ownerInputStyle}>
                  <option value="car">Car</option><option value="bike">Bike</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 7, color: "#aab3bd", fontSize: 13 }}>Brand
                <input name="brand" value={ownerForm.brand} onChange={handleOwnerFormChange} placeholder="e.g. BMW" required style={ownerInputStyle} />
              </label>
              <label style={{ display: "grid", gap: 7, color: "#aab3bd", fontSize: 13 }}>Model
                <input name="model" value={ownerForm.model} onChange={handleOwnerFormChange} placeholder="e.g. 3 Series" required style={ownerInputStyle} />
              </label>
              <label style={{ display: "grid", gap: 7, color: "#aab3bd", fontSize: 13 }}>Year
                <input name="year" type="number" min="1900" max="2100" value={ownerForm.year} onChange={handleOwnerFormChange} placeholder="2024" style={ownerInputStyle} />
              </label>
              <label style={{ display: "grid", gap: 7, color: "#aab3bd", fontSize: 13 }}>Price per day (₹)
                <input name="pricePerDay" type="number" min="1" value={ownerForm.pricePerDay} onChange={handleOwnerFormChange} placeholder="2500" required style={ownerInputStyle} />
              </label>
              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ display: "grid", gap: 7, color: "#aab3bd", fontSize: 13 }}>
                  City / location
                  <input
                    name="location"
                    value={ownerForm.location}
                    onChange={handleOwnerFormChange}
                    placeholder="Bhubaneswar"
                    required
                    style={ownerInputStyle}
                  />
                </label>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={captureOwnerLocation}
                  disabled={locationLoading}
                >
                  {locationLoading
                    ? "Getting Location..."
                    : "⌖ Use My Current Location"}
                </button>

                {gpsCoordinates && (
                  <p style={{ color: "#22c55e", fontSize: 12, margin: 0 }}>
                    GPS captured successfully
                  </p>
                )}

                {locationError && (
                  <p role="alert" style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>
                    {locationError}
                  </p>
                )}
              </div>
              <label style={{ display: "grid", gap: 7, color: "#aab3bd", fontSize: 13, gridColumn: "1 / -1" }}>Description
                <textarea name="description" value={ownerForm.description} onChange={handleOwnerFormChange} placeholder="Describe your vehicle" rows="3" style={{ ...ownerInputStyle, resize: "vertical" }} />
              </label>
              <div style={{ gridColumn: "1 / -1", display: "grid", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: "#aab3bd", fontSize: 13, marginBottom: 9 }}>Vehicle photos (up to 5)</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" className="primary-btn" onClick={openLiveCamera} disabled={ownerPhotos.length >= 5}>Open Live Camera</button>
                    <button type="button" className="secondary-btn" onClick={() => photoInputRef.current?.click()} disabled={ownerPhotos.length >= 5}>Choose Photos</button>
                    <input ref={photoInputRef} type="file" accept="image/*" multiple capture="environment" onChange={handlePhotoFiles} style={{ display: "none" }} />
                  </div>
                  <p style={{ color: "#8795a3", fontSize: 12, margin: "9px 0 0" }}>Live camera works with a laptop webcam or a phone camera. On phones, the browser may offer the rear camera. Allow camera permission when prompted.</p>
                </div>
                {ownerPhotos.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
                    {ownerPhotos.map((photo, index) => (
                      <div key={`${photo.name}-${index}`} style={{ position: "relative", border: "1px solid #344554", borderRadius: 10, overflow: "hidden", background: "#0b141c" }}>
                        <img src={photo.dataUrl} alt={`Vehicle preview ${index + 1}`} style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                        <button type="button" onClick={() => setOwnerPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} aria-label={`Remove photo ${index + 1}`} style={{ position: "absolute", top: 5, right: 5, border: 0, borderRadius: 20, width: 25, height: 25, background: "#111c26", color: "white", cursor: "pointer" }}>×</button>
                        <span style={{ display: "block", padding: 6, color: "#aab3bd", fontSize: 10 }}>Photo {index + 1}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="primary-btn" disabled={ownerSubmitting}>{ownerSubmitting ? "Submitting..." : "Submit for approval ↗"}</button>
              </div>
            </form>
            <p style={{ color: "#8795a3", fontSize: 12, marginBottom: 0 }}>New listings stay hidden until an admin approves them. Photos are compressed in your browser before being saved with this development version; we will move image storage to Amazon S3 before production.</p>
          </section>

          <section className="ridemate-fleet-panel">
            <div className="ridemate-fleet-topbar">
              <div><span className="eyebrow">LIVE RENTAL MANAGEMENT</span><h2>Live Fleet Tracking</h2><p>Monitor active rentals, customer GPS and travelled routes.</p></div>
              <button type="button" className="secondary-btn" onClick={loadOwnerActiveBookings} disabled={trackingLoading}>{trackingLoading ? "Refreshing..." : "Refresh fleet ↻"}</button>
            </div>
            {trackingError && <p role="alert" className="ridemate-map-error">{trackingError}</p>}
            {trackingStatus && <p role="status" className="ridemate-map-status">{trackingStatus}</p>}
            {ownerActiveBookings.length === 0 ? <div className="ridemate-empty-fleet">No confirmed or active rentals yet. When a customer books one of your approved vehicles, it will appear here.</div> : (
              <div className="ridemate-fleet-layout">
                <aside className="ridemate-fleet-sidebar">
                  <div className="ridemate-fleet-sidebar-title"><strong>FLEET VEHICLES</strong><span>{ownerActiveBookings.length} rentals</span></div>
                  {ownerActiveBookings.map((booking) => (
                    <article className="ridemate-fleet-item" key={booking._id}>
                      <div className="ridemate-fleet-item-icon">{booking.vehicle?.type === "bike" ? "🏍" : "🚘"}</div>
                      <div className="ridemate-fleet-item-copy">
                        <strong>{booking.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model}` : "RideMate vehicle"}</strong>
                        <span>Customer · {booking.customer?.name || "Customer"}</span>
                        <span>{booking.startDate} → {booking.endDate}</span>
                        <em className={booking.status === "active" ? "is-live" : "is-confirmed"}>{booking.status === "active" ? "ACTIVE RENTAL" : "CONFIRMED"}</em>
                        {booking.status === "active" && <small>{booking.tracking?.latest ? `GPS updated ${new Date(booking.tracking.latest.recordedAt).toLocaleTimeString()}` : "Waiting for customer GPS"}</small>}
                      </div>
                      <div className="ridemate-fleet-actions">
                        {booking.status === "confirmed" && <button type="button" onClick={() => startVehicleTracking(booking._id)} disabled={trackingLoading}>Start rental</button>}
                        {booking.status === "active" && <button type="button" className="complete" onClick={() => stopVehicleTracking(booking._id)} disabled={trackingLoading}>Complete</button>}
                      </div>
                    </article>
                  ))}
                </aside>
                <div className="ridemate-fleet-map-area">
                  {ownerActiveBookings.filter((b) => b.status === "active").length ? ownerActiveBookings.filter((b) => b.status === "active").map((booking) => (
                    <div key={booking._id} className="ridemate-fleet-map-block">
                      <div className="ridemate-fleet-map-meta"><strong>{booking.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model}` : "Active vehicle"}</strong><span>Customer GPS {booking.tracking?.latest ? "connected" : "not shared yet"}</span></div>
                      <LiveFleetMap location={booking.tracking?.latest || null} trail={booking.tracking?.trail || []} destination={booking.tracking?.destination || null} title="Customer live location & route" height={470} />
                    </div>
                  )) : <div className="ridemate-empty-map">Start a confirmed rental to activate tracking. The customer must then enable GPS sharing from their account.</div>}
                </div>
              </div>
            )}
          </section>

          <section style={{ background: "#111c26", border: "1px solid #293847", borderRadius: 18, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
              <div><span className="eyebrow">YOUR INVENTORY</span><h2 style={{ margin: "8px 0 0" }}>My vehicle listings</h2></div>
              <span style={{ color: "#ff9b55" }}>{ownerVehicles.length} total</span>
            </div>
            {ownerLoading ? <p style={{ color: "#aab3bd" }}>Loading your listings...</p> : ownerVehicles.length === 0 ? (
              <div style={{ textAlign: "center", padding: "34px 12px", color: "#aab3bd" }}><h3 style={{ color: "#f5f5f5" }}>No listings yet</h3><p>Use the form above to submit your first car or bike.</p></div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {ownerVehicles.map((vehicle) => (
                  <article key={vehicle._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", padding: 16, border: "1px solid #293847", borderRadius: 12 }}>
                    <div>
                      <span style={{ color: "#ff9b55", fontSize: 11, letterSpacing: 1 }}>{(vehicle.type || "vehicle").toUpperCase()}</span>
                      <h3 style={{ margin: "6px 0" }}>{vehicle.brand} {vehicle.model}</h3>
                      <p style={{ color: "#aab3bd", margin: 0, fontSize: 13 }}>{vehicle.location} · ₹{Number(vehicle.pricePerDay || 0).toLocaleString("en-IN")}/day</p>
                    </div>
                    <span style={{ padding: "7px 12px", borderRadius: 20, fontSize: 11, letterSpacing: 1, background: vehicle.status === "approved" ? "#123326" : vehicle.status === "rejected" ? "#3a2020" : "#382b17", color: vehicle.status === "approved" ? "#9ce7bd" : vehicle.status === "rejected" ? "#ffb6b6" : "#ffd18a" }}>{(vehicle.status || "pending").toUpperCase()}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {showCompare && (
        <div className="rm-modal-backdrop" role="dialog" aria-modal="true" aria-label="Compare vehicles" onClick={() => setShowCompare(false)}>
          <section className="rm-compare-modal" onClick={(event) => event.stopPropagation()}>
            <div className="rm-compare-heading"><div><span className="eyebrow">SIDE-BY-SIDE</span><h2>Compare vehicles</h2></div><button type="button" onClick={() => setShowCompare(false)} aria-label="Close comparison">×</button></div>
            <div className="rm-compare-grid"><div className="rm-compare-labels"><strong>Vehicle</strong><strong>Category</strong><strong>Price / day</strong><strong>Brand</strong><strong>Model year</strong><strong>Location</strong><strong>Description</strong></div>{compareVehicles.map((vehicle) => <div className="rm-compare-column" key={vehicle.id}>{vehicle.image ? <img src={vehicle.image} alt={vehicle.name}/> : <div className="rm-compare-placeholder">{vehicle.type === "Bike" ? "🏍️" : "🚘"}</div>}<strong>{vehicle.name}</strong><span>{vehicle.type}</span><b>{formatPrice(vehicle.price)}</b><span>{vehicle.brand || "—"}</span><span>{vehicle.year || "—"}</span><span>{vehicle.location || "—"}</span><p>{vehicle.description || "No description available."}</p><button type="button" onClick={() => { setShowCompare(false); setSelectedVehicle(vehicle); }}>View details</button></div>)}</div>
          </section>
        </div>
      )}

      {cameraOpen && (
        <div role="dialog" aria-modal="true" aria-label="Vehicle camera" onClick={closeLiveCamera} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.82)", display: "grid", placeItems: "center", padding: 18 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(760px, 100%)", background: "#111c26", border: "1px solid #344554", borderRadius: 18, padding: 20, color: "#f5f5f5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div><span className="eyebrow">LIVE VEHICLE CAMERA</span><h2 style={{ margin: "6px 0 0" }}>Capture a photo</h2></div>
              <button type="button" onClick={closeLiveCamera} aria-label="Close camera" style={{ border: 0, background: "#263542", color: "white", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>Close ×</button>
            </div>
            {cameraError && <p role="alert" style={{ color: "#ffb6b6", background: "#3a2020", padding: 10, borderRadius: 8 }}>{cameraError}</p>}
            {cameraStream ? (
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", maxHeight: "60vh", background: "#05080b", borderRadius: 12, objectFit: "contain" }} />
            ) : (
              <div style={{ minHeight: 180, display: "grid", placeItems: "center", color: "#aab3bd", textAlign: "center" }}>Camera preview unavailable. Allow camera permission or use Choose Photos.</div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <button type="button" className="secondary-btn" onClick={closeLiveCamera}>Cancel</button>
              <button type="button" className="primary-btn" onClick={captureCameraPhoto} disabled={!cameraStream || ownerPhotos.length >= 5}>Capture Photo ({ownerPhotos.length}/5)</button>
            </div>
            <p style={{ color: "#8795a3", fontSize: 12, marginBottom: 0 }}>Use a well-lit area and capture the front, rear and side of the vehicle. Your browser must allow camera access.</p>
          </div>
        </div>
      )}

      {showCustomerDashboard && authenticatedUser?.role === "customer" && (
        <section className="customer-dashboard">
          <div className="dashboard-heading">
            <div>
              <span className="eyebrow">CUSTOMER SPACE</span>
              <h1>Welcome back, <span>{authenticatedUser.name?.split(" ")[0] || "Rider"}.</span></h1>
              <p>Manage your RideMate account and keep your next journey moving.</p>
            </div>
            <button className="primary-btn" onClick={() => setShowCustomerDashboard(false)}>
              Browse Vehicles <span>↗</span>
            </button>
          </div>

          <div className="dashboard-stat-grid">
            <article className="dashboard-stat-card">
              <span className="dashboard-stat-icon">▣</span>
              <div><strong>{customerBookings.length}</strong><span>Total Bookings</span></div>
            </article>
            <article className="dashboard-stat-card">
              <span className="dashboard-stat-icon">◷</span>
              <div><strong>{customerBookings.filter((b) => b.status === "confirmed" || b.status === "active").length}</strong><span>Upcoming Rides</span></div>
            </article>
            <article className="dashboard-stat-card">
              <span className="dashboard-stat-icon">♡</span>
              <div><strong>{favoriteVehicleIds.length}</strong><span>Saved Vehicles</span></div>
            </article>
          </div>

          <section className="rm-dashboard-analytics">
            <div><span className="eyebrow">YOUR ACTIVITY</span><h2>Booking overview</h2><p>Live summary based on your current booking history.</p></div>
            <div className="rm-analytics-bars">{[{label:"Pending",count:customerBookings.filter((b) => b.status === "pending").length},{label:"Confirmed",count:customerBookings.filter((b) => b.status === "confirmed").length},{label:"Active",count:customerBookings.filter((b) => b.status === "active").length},{label:"Completed",count:customerBookings.filter((b) => b.status === "completed").length},{label:"Cancelled",count:customerBookings.filter((b) => b.status === "cancelled").length}].map((item) => <div className="rm-analytics-bar" key={item.label}><div className="rm-bar-track"><span style={{height:`${Math.max(5, item.count / Math.max(1, customerBookings.length) * 100)}%`}} /></div><strong>{item.count}</strong><small>{item.label}</small></div>)}</div>
          </section>

          <div className="dashboard-content-grid">
            <section className="dashboard-panel bookings-panel">
              <div className="dashboard-panel-heading">
                <div><span className="eyebrow">YOUR JOURNEYS</span><h2>Recent Bookings</h2></div>
                <span className="dashboard-count">{customerBookings.length} bookings</span>
              </div>
              {bookingError && <p role="alert" className="auth-error">{bookingError}</p>}
              {bookingNotice && <p role="status" style={{color:"#75dfa7"}}>{bookingNotice}</p>}
              {customerBookings.length === 0 ? <div className="dashboard-empty-state">
                <div className="empty-state-icon">⌁</div><h3>No bookings yet</h3>
                <p>Your confirmed and cancelled bookings will appear here.</p>
                <button className="primary-btn" onClick={() => setShowCustomerDashboard(false)}>Explore Vehicles <span>↗</span></button>
              </div> : <div style={{display:"grid",gap:12}}>{customerBookings.map((booking) => <article key={booking._id} style={{display:"flex",justifyContent:"space-between",gap:14,flexWrap:"wrap",padding:16,border:"1px solid #293847",borderRadius:12}}>
                <div><h3 style={{margin:"0 0 7px",color:"#f5f5f5"}}>{booking.vehicle ? `${booking.vehicle.brand} ${booking.vehicle.model}` : "RideMate vehicle"}</h3>
                <p style={{margin:"4px 0",color:"#aab3bd",fontSize:13}}>{booking.startDate} to {booking.endDate} · ₹{Number(booking.totalPrice || 0).toLocaleString("en-IN")}</p>
                <span style={{fontSize:11,letterSpacing:1,color:booking.status === "cancelled" ? "#ffaaaa" : "#8fe3b2"}}>{booking.status.toUpperCase()}</span>
                {booking.status === "active" && (
                  <div className="ridemate-customer-tracking-card">
                    <div className="ridemate-customer-tracking-header"><div><strong>Live journey sharing</strong><span>Your GPS is shared with the vehicle owner only during this active rental.</span></div>
                      {customerGpsSharing[booking._id] ? <button type="button" className="ridemate-stop-share" onClick={() => stopCustomerGpsSharing(booking._id)}>Pause GPS sharing</button> : <button type="button" className="ridemate-start-share" onClick={() => startCustomerGpsSharing(booking._id)}>Enable my live GPS</button>}
                    </div>
                    {customerGpsStatus[booking._id] && <p className="ridemate-map-status">{customerGpsStatus[booking._id]}</p>}
                    {customerTrackingErrors[booking._id] && <p role="alert" className="ridemate-map-error">{customerTrackingErrors[booking._id]}</p>}
                    <LiveFleetMap location={customerTrackingLocations[booking._id]?.location || null} trail={customerTrackingLocations[booking._id]?.trail || []} destination={customerTrackingLocations[booking._id]?.destination || null} allowDestination onDestinationSelected={(destination) => saveCustomerDestination(booking._id, destination)} title="Your live ride & planned route" height={360} />
                  </div>
                )}
                </div>
                {booking.status === "confirmed" && <button type="button" className="secondary-btn" onClick={() => cancelCustomerBooking(booking._id)}>Cancel booking</button>}
              </article>)}</div>}
            </section>

            <aside className="dashboard-panel profile-panel">
              <span className="eyebrow">ACCOUNT DETAILS</span>
              <h2>Your Profile</h2>
              <div className="profile-avatar">{(authenticatedUser.name || "R").charAt(0).toUpperCase()}</div>
              <h3>{authenticatedUser.name}</h3>
              <p className="profile-role">RideMate Customer</p>
              <div className="profile-detail"><span>Email</span><strong>{authenticatedUser.email || "Not available"}</strong></div>
              <div className="profile-detail"><span>Account Type</span><strong>Customer</strong></div>
              <div className="profile-detail"><span>Account Status</span><strong className="profile-status">Logged in</strong></div>
            </aside>
          </div>

          <section className="dashboard-panel saved-panel">
            <div className="dashboard-panel-heading">
              <div><span className="eyebrow">KEEP YOUR FAVOURITES CLOSE</span><h2>Saved Vehicles</h2></div>
              <button className="text-link-btn" onClick={() => setShowCustomerDashboard(false)}>Explore rides ↗</button>
            </div>
            {favoriteVehicleIds.length === 0 ? <p className="saved-empty-copy">You haven't saved any vehicles yet. Use the heart icon on a vehicle card to save one.</p> : <div className="rm-saved-list">{marketplaceVehicles.filter((vehicle) => favoriteVehicleIds.includes(String(vehicle.id))).map((vehicle) => <article key={vehicle.id}><strong>{vehicle.name}</strong><span>{formatPrice(vehicle.price)} / day · {vehicle.location}</span><button type="button" onClick={() => toggleFavorite(vehicle.id)}>Remove</button></article>)}</div>}
          </section>

          <div className="dashboard-help-strip">
            <div><strong>Ready for your next journey?</strong><span>Explore cars and bikes available on RideMate.</span></div>
            <button className="primary-btn" onClick={() => setShowCustomerDashboard(false)}>Find a Ride <span>↗</span></button>
          </div>
        </section>
      )}

      {!showCustomerDashboard && !showAdminDashboard && !showOwnerDashboard && <main>
        {/* HERO */}
        <section className="hero" id="home">
          <div className="hero-overlay"></div>

          <div className="hero-content">
            <div className="hero-badge">
              <span className="live-dot"></span>
              YOUR CITY. YOUR RIDE. YOUR FREEDOM.
            </div>

            <h1>
              Every journey
              <br />
              deserves a
              <br />
              <span>better ride.</span>
            </h1>

            <p>
              Find the perfect car or bike around you.
              Book directly, explore freely and make every
              journey unforgettable.
            </p>

            <div className="hero-buttons">
              <button className="primary-btn" onClick={scrollToVehicles}>
                Explore Vehicles <span>↗</span>
              </button>

              <a href="#how-it-works" className="secondary-btn">
                Discover how it works <span>→</span>
              </a>
            </div>

            <div className="hero-stats">
              <div>
                <strong>Cars & Bikes</strong>
                <span>One marketplace</span>
              </div>
              <div className="stat-divider"></div>
              <div>
                <strong>20 KM</strong>
                <span>Local discovery</span>
              </div>
              <div className="stat-divider"></div>
              <div>
                <strong>Easy Booking</strong>
                <span>Simple experience</span>
              </div>
            </div>
          </div>

          <div className="hero-side-text">
            RIDEMATE / DRIVE YOUR WAY
          </div>

          <div className="hero-bottom-label">
            <span>01</span> / EXPLORE YOUR NEXT RIDE
          </div>
        </section>

        {/* SEARCH */}
        <section className="search-section">
          <div className="search-heading">
            <div>
              <span className="eyebrow">FIND YOUR RIDE</span>
              <h2>Where are you heading?</h2>
            </div>
            <span className="location-note">⌖ Explore vehicles near your location</span>
          </div>

          <div className="search-box">
            <div className="search-field">
              <label>YOUR LOCATION</label>
              <div className="input-wrap">
                <span className="field-icon">⌖</span>
                <input
                  type="text"
                  placeholder="Enter city or area"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setSearchApplied(false);
                  }}
                />
              </div>
            </div>

            <div className="search-field">
              <label>VEHICLE CATEGORY</label>
              <div className="input-wrap">
                <span className="field-icon">▣</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="All">All Vehicles</option>
                  <option value="Car">Cars</option>
                  <option value="Bike">Bikes</option>
                </select>
              </div>
            </div>

            <div className="search-field radius-field">
              <label>SEARCH RADIUS</label>
              <div className="input-wrap">
                <span className="field-icon">◎</span>
                <select
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                >
                  <option value="5">Within 5 KM</option>
                  <option value="10">Within 10 KM</option>
                  <option value="20">Within 20 KM</option>
                  <option value="50">Within 50 KM</option>
                </select>
              </div>
            </div>

            <div className="search-field">
              <label>FROM DATE</label>
              <div className="input-wrap"><input type="date" min={new Date().toISOString().slice(0,10)} value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setSearchApplied(false); }} /></div>
            </div>
            <div className="search-field">
              <label>TO DATE</label>
              <div className="input-wrap"><input type="date" min={filterStartDate || new Date().toISOString().slice(0,10)} value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setSearchApplied(false); }} /></div>
            </div>
            <button
              className="search-btn"
              onClick={() => {
                setSearchApplied(true);
                loadApprovedVehicles();
                scrollToVehicles();
              }}
            >
              Search Rides <span>↗</span>
            </button>
          </div>

          <p className="search-caption">
            <span>✦</span> Browse admin-approved owner listings. Location filtering uses the city or area name; distance-based radius filtering will be added with GPS coordinates.
          </p>
        </section>

        {/* VEHICLES */}
        <section className="vehicles-section" id="vehicles">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE RIDEMATE COLLECTION</span>
              <h2>Find your <span>kind of ride.</span></h2>
              <p>From everyday commutes to unforgettable road trips.</p>
            </div>

            <a href="#vehicles" className="view-all">
              Explore collection <span>↗</span>
            </a>
          </div>

          <div className="category-tabs">
            {["All", "Car", "Bike"].map((item) => (
              <button
                key={item}
                className={category === item ? "category-tab active" : "category-tab"}
                onClick={() => setCategory(item)}
              >
                {item === "All" ? "All Rides" : item === "Car" ? "Cars" : "Bikes"}
                <span>
                  {item === "All"
                    ? marketplaceVehicles.length
                    : marketplaceVehicles.filter((v) => v.type === item).length}
                </span>
              </button>
            ))}
          </div>

          <div className="rm-advanced-filters">
            <div className="rm-filter-title"><div><span className="eyebrow">REFINE YOUR SEARCH</span><h3>Advanced filters</h3></div><button type="button" className={showFavoritesOnly ? "rm-filter-toggle active" : "rm-filter-toggle"} onClick={() => setShowFavoritesOnly((v) => !v)}>♡ Favorites only</button></div>
            <label>Brand<select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}><option value="All">All brands</option>{availableBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select></label>
            <label>Minimum price / day<input type="number" min="0" placeholder="₹ Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} /></label>
            <label>Maximum price / day<input type="number" min="0" placeholder="₹ Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} /></label>
            <label>Sort by<select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}><option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Vehicle name</option></select></label>
            <button type="button" className="rm-clear-filters" onClick={() => { setCategory("All"); setLocation(""); setSearchApplied(false); setFilterBrand("All"); setMinPrice(""); setMaxPrice(""); setSortOrder("recommended"); setShowFavoritesOnly(false); }}>Clear filters</button>
          </div>
          <div className="rm-compare-toolbar"><span>{compareVehicleIds.length} of 3 vehicles selected for comparison</span><div><button type="button" className="rm-clear-filters" onClick={() => setCompareVehicleIds([])}>Clear</button><button type="button" className="primary-btn" disabled={compareVehicleIds.length < 2} onClick={() => setShowCompare(true)}>Compare vehicles ↗</button></div></div>

          {marketplaceError && <p className="auth-error" role="alert">{marketplaceError}</p>}
          {marketplaceLoading ? (
            <div className="no-results"><h3>Loading available vehicles...</h3></div>
          ) : (
          <div className="vehicle-grid">
            {filteredVehicles.length > 0 ? (
              filteredVehicles.map((vehicle) => (
                <article className="vehicle-card" key={vehicle.id}>
                  <div className="vehicle-image-wrap">
                    {vehicle.image ? (
                      <img src={vehicle.image} alt={vehicle.name} loading="lazy" />
                    ) : (
                      <div style={{ minHeight: 190, height: "100%", display: "grid", placeItems: "center", background: "#17232d", fontSize: 64 }}>
                        {vehicle.type === "Bike" ? "🏍️" : "🚘"}
                      </div>
                    )}

                    <span className="vehicle-tag">{vehicle.tag}</span>

                    <button type="button" className={favoriteVehicleIds.includes(String(vehicle.id)) ? "favorite-btn saved" : "favorite-btn"} aria-label={`${favoriteVehicleIds.includes(String(vehicle.id)) ? "Remove" : "Save"} ${vehicle.name}`} aria-pressed={favoriteVehicleIds.includes(String(vehicle.id))} onClick={() => toggleFavorite(vehicle.id)}>{favoriteVehicleIds.includes(String(vehicle.id)) ? "♥" : "♡"}</button>

                    <div className="image-location">
                      ⌖ {vehicle.location}
                    </div>
                  </div>

                  <div className="vehicle-info">
                    <div className="vehicle-meta">
                      <span>{vehicle.type}</span>
                      <span>✓ Admin approved</span>
                    </div>

                    <h3>{vehicle.name}</h3>
                    <p className="vehicle-details">{vehicle.details}</p>

                    <div className="vehicle-bottom">
                      <div className="vehicle-price">
                        <strong>{formatPrice(vehicle.price)}</strong>
                        <span>/ day</span>
                      </div>

                      <button type="button" className={compareVehicleIds.includes(String(vehicle.id)) ? "rm-compare-chip selected" : "rm-compare-chip"} onClick={() => toggleCompare(vehicle.id)} disabled={!compareVehicleIds.includes(String(vehicle.id)) && compareVehicleIds.length >= 3}>{compareVehicleIds.includes(String(vehicle.id)) ? "✓ Added" : "+ Compare"}</button>
                      <button
                        type="button"
                        className="details-btn"
                        onClick={() => setSelectedVehicle(vehicle)}
                      >
                        View Details <span>↗</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="no-results">
                <span>⌖</span>
                <h3>{marketplaceVehicles.length === 0 ? "No approved vehicles yet" : "No vehicles found"}</h3>
                <p>
                  {marketplaceVehicles.length === 0
                    ? "Vehicles approved by the RideMate admin team will appear here."
                    : "Try another location or clear your filters."}
                </p>
                {marketplaceVehicles.length > 0 && (
                  <button
                    className="primary-btn"
                    onClick={() => {
                      setLocation("");
                      setCategory("All");
                      setRadius("20");
                      setSearchApplied(false);
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>
          )}

          <p className="demo-note">
            Showing approved vehicles submitted by RideMate owners.
          </p>
        </section>

        {/* CATEGORIES */}
        <section className="categories-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CHOOSE YOUR STYLE</span>
              <h2>What's your <span>next ride?</span></h2>
              <p>Choose your category and start exploring.</p>
            </div>
          </div>

          <div className="category-showcase">
            <button
              className="showcase-card car-showcase"
              onClick={() => chooseCategory("Car")}
            >
              <img
                src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1000"
                alt="Sports car"
                loading="lazy"
              />
              <div className="showcase-content">
                <span>01 / FOUR WHEELS</span>
                <h3>Find your drive.</h3>
                <p>Explore cars for every kind of journey.</p>
                <strong>EXPLORE CARS ↗</strong>
              </div>
            </button>

            <button
              className="showcase-card bike-showcase"
              onClick={() => chooseCategory("Bike")}
            >
              <img
                src="https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1000"
                alt="Motorcycle"
                loading="lazy"
              />
              <div className="showcase-content">
                <span>02 / TWO WHEELS</span>
                <h3>Feel the freedom.</h3>
                <p>Find bikes for your next adventure.</p>
                <strong>EXPLORE BIKES ↗</strong>
              </div>
            </button>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="how-section" id="how-it-works">
          <div className="how-intro">
            <span className="eyebrow">SIMPLE. SMART. RIDEMATE.</span>
            <h2>Your ride is just <span>three steps away.</span></h2>
            <p>Getting on the road should be easy. We make it simple.</p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <span className="step-number">01</span>
              <div className="step-icon">⌕</div>
              <h3>Discover</h3>
              <p>Find cars and bikes listed by owners near your location.</p>
            </div>

            <div className="step-card">
              <span className="step-number">02</span>
              <div className="step-icon">▣</div>
              <h3>Book</h3>
              <p>Choose your vehicle, rental dates and complete your booking.</p>
            </div>

            <div className="step-card">
              <span className="step-number">03</span>
              <div className="step-icon">↗</div>
              <h3>Ride</h3>
              <p>Meet the owner, collect your vehicle and enjoy your journey.</p>
            </div>
          </div>
        </section>

        {/* OWNER CTA */}
        <section className="owner-section" id="owner">
          <div className="owner-content">
            <span className="eyebrow">YOUR VEHICLE. YOUR OPPORTUNITY.</span>
            <h2>Have a vehicle?<br /><span>Let it earn for you.</span></h2>
            <p>
              List your car or bike on RideMate. Connect with nearby
              renters and turn your idle vehicle into an opportunity.
            </p>
            <button className="primary-btn owner-btn">
              Become a Vehicle Owner <span>↗</span>
            </button>
          </div>

          <div className="owner-decoration">
            <div className="owner-circle"></div>
            <span className="owner-label">LIST / CONNECT / EARN</span>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-top">
            <div>
              <a href="#home" className="logo footer-logo">
                Ride<span>Mate</span><i>.</i>
              </a>
              <p>Find your ride. Own your journey.</p>
            </div>

            <div className="footer-links">
              <a href="#home">Home</a>
              <a href="#vehicles">Explore</a>
              <a href="#how-it-works">How it works</a>
              <a href="#owner">Become an Owner</a>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© 2026 RideMate. All rights reserved.</p>
            <p>Made for journeys worth remembering. ✦</p>
          </div>
        </footer>
      </main>}

      {selectedVehicle && (() => {
        const today = new Date().toISOString().slice(0, 10);
        const startDate = bookingStartDate ? new Date(`${bookingStartDate}T00:00:00`) : null;
        const endDate = bookingEndDate ? new Date(`${bookingEndDate}T00:00:00`) : null;
        const days = startDate && endDate && endDate > startDate
          ? Math.ceil((endDate - startDate) / 86400000) : 0;
        const total = days * Number(selectedVehicle.price || 0);
        const qrText = `RIDEMATE DEMO ONLY | ${selectedVehicle.name} | ${bookingStartDate} - ${bookingEndDate} | INR ${total} | NOT A REAL PAYMENT`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(qrText)}`;
        const resetDetails = () => {
          setSelectedVehicle(null); setShowDemoPayment(false); setDemoPaymentComplete(false);
          setBookingStartDate(""); setBookingEndDate("");
        };
        return (
          <div role="presentation" onClick={resetDetails} style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(2,6,10,.9)",backdropFilter:"blur(14px)",display:"grid",placeItems:"center",padding:18,overflowY:"auto"}}>
            <section role="dialog" aria-modal="true" aria-labelledby="vehicle-details-title" onClick={e=>e.stopPropagation()}
              style={{width:"min(1120px,100%)",maxHeight:"94vh",overflowY:"auto",background:"linear-gradient(145deg,#142330,#0b121a)",color:"#f5f7fa",border:"1px solid #304454",borderRadius:24,boxShadow:"0 30px 100px rgba(0,0,0,.65)",position:"relative"}}>
              <button type="button" aria-label="Close details" onClick={resetDetails} style={{position:"absolute",zIndex:3,top:16,right:16,width:42,height:42,border:"1px solid #ffffff44",borderRadius:"50%",background:"#07111bdc",color:"#fff",fontSize:25,cursor:"pointer"}}>×</button>
              <style>{`@media (max-width: 760px) {
  .ridemate-detail-layout { grid-template-columns: 1fr !important; }
  .ridemate-detail-aside { border-left: 0 !important; border-top: 1px solid #293e4d; }
  .ridemate-detail-hero { height: 240px !important; }
}`}</style>
              <div className="ridemate-detail-layout" style={{display:"grid",gridTemplateColumns:"minmax(0,1.15fr) minmax(320px,.85fr)"}} >
                <div style={{padding:24}}>
                  <div className="ridemate-detail-hero" style={{height:360,borderRadius:18,overflow:"hidden",background:"#1b2935",border:"1px solid #2a3a49",display:"grid",placeItems:"center"}}>
                    {selectedVehicle.image ? <img src={selectedVehicle.image} alt={selectedVehicle.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/> : <span style={{fontSize:100}}>{selectedVehicle.type==="Bike"?"🏍️":"🚘"}</span>}
                  </div>
                  {selectedVehicle.images?.length>1 && <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:12}}>
                    {selectedVehicle.images.slice(1,5).map((img,i)=><img key={i} src={img} alt={`${selectedVehicle.name} ${i+2}`} style={{width:"100%",height:86,objectFit:"cover",borderRadius:12,border:"1px solid #304454"}}/>)}
                  </div>}
                  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:24}}>
                    <span style={{background:"#ff704222",color:"#ff855b",padding:"7px 12px",borderRadius:30,fontSize:11,fontWeight:800,letterSpacing:1}}>{selectedVehicle.type.toUpperCase()}</span>
                    <span style={{color:"#78dda8",fontSize:12}}>● ADMIN APPROVED</span>
                    <span style={{color:"#9aabba",fontSize:12}}>⌖ {selectedVehicle.location}</span>
                  </div>
                  <h1 id="vehicle-details-title" style={{fontSize:"clamp(28px,4vw,42px)",lineHeight:1.1,margin:"14px 0 10px",letterSpacing:"-.8px"}}>{selectedVehicle.name}</h1>
                  <p style={{color:"#aab9c7",lineHeight:1.8,fontSize:15,margin:"0 0 24px"}}>{selectedVehicle.description || selectedVehicle.details || "A great ride for your next journey."}</p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
                    {[["VEHICLE TYPE",selectedVehicle.type],["MODEL YEAR",selectedVehicle.year||"Not specified"],["PICKUP AREA",selectedVehicle.location||"Not specified"]].map(([k,v])=><div key={k} style={{padding:15,borderRadius:14,background:"#172936",border:"1px solid #293e4d"}}><div style={{fontSize:10,color:"#8295a6",letterSpacing:1,fontWeight:700}}>{k}</div><div style={{fontSize:14,fontWeight:700,marginTop:8}}>{v}</div></div>)}
                  </div>
                  <p style={{color:"#647889",fontSize:11,marginTop:22}}>Listing ID: {selectedVehicle.id}</p>
                </div>
                <aside className="ridemate-detail-aside" style={{background:"#142432",borderLeft:"1px solid #293e4d",padding:26}}>
                  <div style={{fontSize:11,color:"#ff855b",fontWeight:800,letterSpacing:1.6}}>YOUR NEXT RIDE STARTS HERE</div>
                  <h2 style={{fontSize:27,margin:"9px 0 6px"}}>Book this ride</h2>
                  <p style={{color:"#91a2b2",fontSize:13,lineHeight:1.6,marginTop:0}}>Select your rental dates and see the estimated price.</p>
                  <div style={{padding:"17px 18px",borderRadius:16,background:"#0d1822",border:"1px solid #304454",margin:"20px 0"}}>
                    <div style={{color:"#8fa1b0",fontSize:12}}>Rental price</div><div style={{fontSize:30,fontWeight:850,marginTop:4}}>{formatPrice(selectedVehicle.price)}<span style={{fontSize:13,color:"#91a2b2",fontWeight:500}}> / day</span></div>
                  </div>
                  {!showDemoPayment && !demoPaymentComplete ? <>
                    <label style={{display:"grid",gap:8,fontSize:12,color:"#b7c4cf",marginBottom:14}}>PICKUP DATE
                      <input type="date" min={today} value={bookingStartDate} onChange={e=>{setBookingStartDate(e.target.value);setBookingEndDate("");}} style={{width:"100%",boxSizing:"border-box",padding:14,borderRadius:11,border:"1px solid #344b5d",background:"#0b151e",color:"#fff",font:"inherit",colorScheme:"dark"}}/>
                    </label>
                    <label style={{display:"grid",gap:8,fontSize:12,color:"#b7c4cf",marginBottom:16}}>RETURN DATE
                      <input type="date" min={bookingStartDate||today} value={bookingEndDate} onChange={e=>setBookingEndDate(e.target.value)} style={{width:"100%",boxSizing:"border-box",padding:14,borderRadius:11,border:"1px solid #344b5d",background:"#0b151e",color:"#fff",font:"inherit",colorScheme:"dark"}}/>
                    </label>
                    <div style={{borderTop:"1px solid #304454",paddingTop:16,display:"grid",gap:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",color:"#9aabba",fontSize:13}}><span>Rental duration</span><strong style={{color:"#fff"}}>{days?`${days} day${days>1?"s":""}`:"Select dates"}</strong></div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:"#c1ccd5",fontSize:14}}>Estimated total</span><strong style={{fontSize:25,color:"#ff8658"}}>{formatPrice(total)}</strong></div>
                    </div>
                    <button type="button" disabled={!days} onClick={()=>setShowDemoPayment(true)} style={{width:"100%",marginTop:22,padding:16,border:0,borderRadius:12,background:days?"linear-gradient(100deg,#ff6335,#ff8a50)":"#48535d",color:"#101820",fontWeight:850,fontSize:15,cursor:days?"pointer":"not-allowed"}}>Continue to payment →</button>
                    <div style={{fontSize:11,color:"#718596",textAlign:"center",lineHeight:1.6,marginTop:12}}>Demo booking flow · No real reservation or payment will be made.</div>
                  </> : demoPaymentComplete ? <div style={{textAlign:"center",padding:"30px 8px"}}>
                    <div style={{width:68,height:68,borderRadius:"50%",display:"grid",placeItems:"center",margin:"0 auto 18px",background:"#3fc48522",color:"#6ee0a6",fontSize:34}}>✓</div>
                    <h3 style={{fontSize:23,margin:"0 0 8px"}}>Booking confirmed</h3>
                    <p style={{color:"#9aabba",fontSize:13,lineHeight:1.7}}>Your booking has been saved. No money was collected; payment is still a demo.</p>
                    <button type="button" onClick={resetDetails} style={{width:"100%",padding:15,border:0,borderRadius:12,background:"#ff7042",fontWeight:800,cursor:"pointer",marginTop:14}}>Done</button>
                  </div> : <>
                    <button type="button" onClick={()=>setShowDemoPayment(false)} style={{background:"transparent",border:0,color:"#9db0bf",cursor:"pointer",padding:0,marginBottom:14}}>← Back to dates</button>
                    <h3 style={{fontSize:19,margin:"0 0 6px"}}>Choose demo payment</h3>
                    <p style={{fontSize:12,color:"#91a2b2",lineHeight:1.6}}>Prototype only. Do not send money.</p>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,margin:"16px 0"}}>
                      <button type="button" onClick={()=>setDemoPaymentMethod("upi")} style={{padding:12,borderRadius:11,border:demoPaymentMethod==="upi"?"1px solid #ff784b":"1px solid #344b5d",background:demoPaymentMethod==="upi"?"#ff784b20":"#0d1822",color:"#fff",cursor:"pointer"}}>UPI QR</button>
                      <button type="button" onClick={()=>setDemoPaymentMethod("cash")} style={{padding:12,borderRadius:11,border:demoPaymentMethod==="cash"?"1px solid #ff784b":"1px solid #344b5d",background:demoPaymentMethod==="cash"?"#ff784b20":"#0d1822",color:"#fff",cursor:"pointer"}}>Pay at pickup</button>
                    </div>
                    {demoPaymentMethod==="upi" ? <div style={{background:"#fff",borderRadius:16,padding:16,textAlign:"center",color:"#18212a"}}>
                      <img src={qrUrl} alt="Demo payment QR code" style={{width:190,height:190,objectFit:"contain",maxWidth:"100%"}}/><div style={{fontWeight:850,marginTop:5}}>DEMO QR CODE</div><div style={{fontSize:11,color:"#59636c",marginTop:5}}>Sample only · Not connected to UPI</div>
                    </div> : <div style={{padding:18,borderRadius:14,background:"#0d1822",color:"#c1ccd5",fontSize:13,lineHeight:1.7}}>Sample pay-at-pickup selection. No real booking is created.</div>}
                    <div style={{display:"flex",justifyContent:"space-between",margin:"18px 0",paddingTop:15,borderTop:"1px solid #304454"}}><span style={{color:"#aab9c7"}}>Demo total</span><strong style={{fontSize:22}}>{formatPrice(total)}</strong></div>
                    <button type="button" disabled={bookingSubmitting} onClick={confirmVehicleBooking} style={{width:"100%",padding:16,border:0,borderRadius:12,background:"linear-gradient(100deg,#ff6335,#ff8a50)",color:"#101820",fontWeight:850,fontSize:15,cursor:bookingSubmitting?"wait":"pointer"}}>{bookingSubmitting ? "Confirming booking..." : "Confirm demo booking"}</button>
                    {bookingError && <p role="alert" style={{color:"#ffaaaa",fontSize:12}}>{bookingError}</p>}
                    <div style={{fontSize:10,color:"#718596",lineHeight:1.6,textAlign:"center",marginTop:10}}>This confirms a reservation in RideMate. No real payment is collected.</div>
                    <div style={{fontSize:10,color:"#718596",lineHeight:1.6,textAlign:"center",marginTop:10}}>This only demonstrates the interface. It does not verify payment or charge a customer.</div>
                  </>}
                </aside>
              </div>
            </section>
          </div>
        );
      })()}

      {authView && (
        <div
          className="auth-overlay"
          onClick={() => setAuthView(null)}
        >
          <div
            className="auth-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="auth-close"
              onClick={() => setAuthView(null)}
              aria-label="Close authentication"
            >
              ×
            </button>

            <div className="auth-brand">
              Ride<span>Mate</span>.
            </div>

            <span className="eyebrow">
              YOUR JOURNEY STARTS HERE
            </span>

            <h2>
              {{
                login: "Welcome back.",
                register: "Create your account.",
                "verify-registration-otp": "Verify your email.",
                "forgot-password": "Reset your password.",
                "verify-reset-otp": "Verify reset OTP.",
                "reset-password": "Choose a new password."
              }[authView]}
            </h2>

            <p className="auth-description">
              {{
                login: "Sign in to continue your RideMate journey.",
                register: "Join RideMate and discover a better way to travel.",
                "verify-registration-otp": `Enter the 6-digit code sent to ${authForm.email}.`,
                "forgot-password": "Enter your registered email address to receive a password reset code.",
                "verify-reset-otp": `Enter the 6-digit password reset code sent to ${authForm.email}.`,
                "reset-password": "Your identity is verified. Create a strong new password."
              }[authView]}
            </p>

            {authMessage && (
              <div className="auth-success">
                {authMessage}
              </div>
            )}

            {authError && (
              <div className="auth-error">
                {authError}
              </div>
            )}

            <form
              className="auth-form"
              onSubmit={handleAuthSubmit}
            >
              {authView === "register" && (
                <>
                  <label>FULL NAME</label>
                  <input type="text" name="name" placeholder="Enter your full name" value={authForm.name} onChange={handleAuthChange} autoComplete="name" required />

                  <label>MOBILE NUMBER</label>
                  <input type="tel" name="mobile" placeholder="Enter your mobile number" value={authForm.mobile} onChange={handleAuthChange} autoComplete="tel" minLength={10} required />

                  <label>ACCOUNT TYPE</label>
                  <select name="role" value={authForm.role} onChange={handleAuthChange}>
                    <option value="customer">Customer – Rent vehicles</option>
                    <option value="owner">Owner – List my vehicles</option>
                  </select>
                </>
              )}

              {(authView === "login" || authView === "register" || authView === "forgot-password") && (
                <>
                  <label>EMAIL ADDRESS</label>
                  <input type="email" name="email" placeholder="you@example.com" value={authForm.email} onChange={handleAuthChange} autoComplete="email" required />
                </>
              )}

              {(authView === "login" || authView === "register") && (
                <>
                  <label>PASSWORD</label>
                  <input type="password" name="password" placeholder="Enter your password" value={authForm.password} onChange={handleAuthChange} autoComplete={authView === "login" ? "current-password" : "new-password"} minLength={8} required />
                </>
              )}

              {authView === "register" && (
                <>
                  <label>CONFIRM PASSWORD</label>
                  <input type="password" name="confirmPassword" placeholder="Confirm your password" value={authForm.confirmPassword} onChange={handleAuthChange} autoComplete="new-password" required />
                </>
              )}

              {(authView === "verify-registration-otp" || authView === "verify-reset-otp") && (
                <>
                  <label>6-DIGIT OTP</label>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter the OTP from your email" value={authOtp} onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} pattern="[0-9]{6}" maxLength={6} required />
                  <button type="button" className="secondary-btn" onClick={handleResendAuthOtp} disabled={authLoading || otpCooldown > 0}>
                    {otpCooldown > 0 ? `Resend available in ${otpCooldown}s` : "Resend OTP"}
                  </button>
                </>
              )}

              {authView === "reset-password" && (
                <>
                  <label>NEW PASSWORD</label>
                  <input type="password" minLength={8} autoComplete="new-password" placeholder="Enter new password" value={resetPasswordForm.newPassword} onChange={(e) => setResetPasswordForm((current) => ({ ...current, newPassword: e.target.value }))} required />
                  <label>CONFIRM NEW PASSWORD</label>
                  <input type="password" minLength={8} autoComplete="new-password" placeholder="Confirm new password" value={resetPasswordForm.confirmPassword} onChange={(e) => setResetPasswordForm((current) => ({ ...current, confirmPassword: e.target.value }))} required />
                </>
              )}

              {authView === "login" && (
                <button type="button" onClick={() => { setAuthError(""); setAuthMessage(""); setAuthView("forgot-password"); }} style={{ justifySelf: "end", border: 0, background: "transparent", color: "#ff9b55", cursor: "pointer", padding: 0 }}>
                  Forgot Password?
                </button>
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={authLoading}
              >
                {authLoading
                  ? "Please wait..."
                  : ({
                      login: "Login to RideMate →",
                      register: "Send verification OTP →",
                      "verify-registration-otp": "Verify email & create account →",
                      "forgot-password": "Send reset OTP →",
                      "verify-reset-otp": "Verify OTP →",
                      "reset-password": "Update password →"
                    }[authView] || "Continue →")}
              </button>
            </form>

            {(authView === "login" || authView === "register") && (
              <p className="auth-switch">
                {authView === "login" ? "New to RideMate?" : "Already have an account?"}
                <button type="button" onClick={() => {
                  setAuthError("");
                  setAuthMessage("");
                  setAuthView(authView === "login" ? "register" : "login");
                }}>
                  {authView === "login" ? "Create account" : "Login"}
                </button>
              </p>
            )}

            {authView !== "login" && authView !== "register" && (
              <p className="auth-switch">
                <button type="button" onClick={() => {
                  setAuthError("");
                  setAuthMessage("");
                  setAuthView("login");
                }}>
                  Back to Login
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
