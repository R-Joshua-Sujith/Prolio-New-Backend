const axios = require("axios");
const VisitedLogModel = require("../../../models/visitedLog");
const ProductModel = require("../../../models/Product");
// Utility function to get location details
const getLocationDetails = async (latitude, longitude) => {
  try {
    // Check if coordinates are provided
    if (!latitude || !longitude) {
      return {
        formatted_address: "No Location Provided",
        city: "",
        state: "",
        country: "",
        postcode: "",
      };
    }

    // OpenStreetMap Nominatim geocoding (no API key required)
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: {
          format: "json",
          lat: latitude,
          lon: longitude,
          zoom: 10,
          addressdetails: 1,
        },
        headers: {
          "User-Agent": "YourProductName/1.0", // Required by Nominatim usage policy
        },
      }
    );

    const address = response.data.address;
    console.log("address", address);
    return {
      formatted_address: response.data.display_name,
      city:
        address.city || address.town || address.village || address.county || "",
      state: address.state || address.province || "",
      country: address.country || "",
      postcode: address.postcode || "",
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return {
      formatted_address: "Unknown Location",
      city: "",
      state: "",
      country: "",
      postcode: "",
    };
  }
};

const saveVisitedLogs = async (latitude, longitude, userId, productId) => {
  try {
    const product = await ProductModel.findById(productId);

    // Return early if the visitor is the product owner
    if (product.ownerId.toString() === userId.toString()) {
      return;
    }

    // Increment views only for non-owners
    product.totalViews = product.totalViews + 1;
    await product.save();

    const locationDetails = await getLocationDetails(latitude, longitude);
    const visitedLog = await VisitedLogModel.findOne({
      productId: productId,
    });

    const visitorData = {
      coordinates: {
        latitude,
        longitude,
        locationDetails: {
          formatted_address: locationDetails.formatted_address,
          city: locationDetails.city,
          state: locationDetails.state,
          country: locationDetails.country,
          postcode: locationDetails.postcode,
        },
      },
      userId: userId,
    };

    if (visitedLog) {
      visitedLog.users.push(visitorData);
      await visitedLog.save();
    } else {
      const newVisitedLog = new VisitedLogModel({
        productId: productId,
        users: [visitorData],
      });
      await newVisitedLog.save();
    }
  } catch (error) {
    console.error("Error saving visited logs:", error);
  }
};
module.exports = { getLocationDetails, saveVisitedLogs };
