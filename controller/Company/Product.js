const ProductModel = require("../../models/Product");
const CustomerModel = require("../../models/Customer");
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");
const CategoryModel = require("../../models/Category");
const VisitedLogModel = require("../../models/visitedLog");
const mongoose = require("mongoose");
const { createLogs } = require("./Log");
const visitedLog = require("../../models/visitedLog");

/**
 *  Function to check the API is working
 */
const test = async (req, res) => {
  try {
    res.status(200).json({ message: "Product Success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * API Function to create a product
 * @param {Object} req - request object
 * @param {Object} res - response object
 */
const createProduct = async (req, res) => {
  try {
    const { formData } = JSON.parse(req.body.data);

    let ownerId = req.user.id;

    if (!ownerId) {
      return sendResponse(res, 500, true, "User ID Not Found");
    }

    // Check if product with same id or slug already exists
    const existingProduct = await ProductModel.findOne({
      $or: [
        { "basicDetails.id": formData.basicDetails.id },
        { "basicDetails.slug": formData.basicDetails.slug },
      ],
    });

    if (existingProduct) {
      const duplicateField =
        existingProduct.basicDetails.id === formData.basicDetails.id
          ? "id"
          : "slug";
      return sendResponse(
        res,
        400,
        false,
        `Product with this ${duplicateField} already exists`
      );
    }

    const uploadedImages = await Promise.all(
      (req.files || []).map(async (file) => {
        const { url, filename } = await uploadToS3(
          file.buffer,
          file.originalname,
          file.mimetype,
          "products"
        );
        return { url, publicId: filename };
      })
    );

    const newProduct = await ProductModel.create({
      basicDetails: formData.basicDetails,
      ownerId,
      images: uploadedImages,
      colors: formData.colors,
      attributes: formData.attributes,
      category: formData.category,
      dynamicSteps: formData.dynamicSteps.steps,
      category: {
        categoryId: formData.category.categoryId,
        subCategoryId: formData.category.subCategoryId,
      },
      opportunities: formData.opportunities,
    });

    sendResponse(res, 201, true, "Product created successfully", newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    sendResponse(res, 500, false, "Error creating product", {
      details: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  console.log("hi");
  try {
    const productId = req.params.id;

    const formData = req.body.formData;
    const ownerId = req.user.id;

    console.log("id", productId);
    console.log(formData);

    if (!ownerId) {
      return sendResponse(res, 500, true, "User ID Not Found");
    }

    // Check if product exists
    const existingProduct = await ProductModel.findById(productId);

    if (!existingProduct) {
      return sendResponse(res, 404, false, "Product not found");
    }

    // Verify ownership
    if (existingProduct.ownerId.toString() !== ownerId) {
      return sendResponse(res, 403, false, "Unauthorized to edit this product");
    }

    // Check if new id/slug conflicts with other products (excluding current product)
    const duplicateProduct = await ProductModel.findOne({
      _id: { $ne: productId },
      $or: [
        { "basicDetails.id": formData.basicDetails.id },
        { "basicDetails.slug": formData.basicDetails.slug },
      ],
    });

    if (duplicateProduct) {
      const duplicateField =
        duplicateProduct.basicDetails.id === formData.basicDetails.id
          ? "id"
          : "slug";
      return sendResponse(
        res,
        400,
        false,
        `Another product with this ${duplicateField} already exists`
      );
    }

    // Update product
    const updatedProduct = await ProductModel.findByIdAndUpdate(
      productId,
      {
        basicDetails: formData.basicDetails,
        colors: formData.colors,
        attributes: formData.attributes,
        category: {
          categoryId: formData.category.categoryId,
          subCategoryId: formData.category.subCategoryId,
        },
        dynamicSteps: formData.dynamicSteps,
        opportunities: formData.opportunities,
      },
      { new: true }
    );

    const logData = {
      userId: req.user.id,
      userModel: "Customer",
      targetId: productId,
      targetModel: "Product",
      action: `PRODUCT_UPDATED`,
    };

    createLogs(logData);
    sendResponse(
      res,
      200,
      true,
      "Product updated successfully",
      updatedProduct
    );
  } catch (error) {
    console.error("Error updating product:", error);
    sendResponse(res, 500, false, "Error updating product", {
      details: error.message,
    });
  }
};

/**
 * Function to delete a product from S3 and database
 * @param {Object} req - request object
 * @param {Object} res - response object
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await ProductModel.findById(id);
    if (!product) {
      return sendResponse(res, 404, false, "Product not found");
    }
    await Promise.all(
      product.images.map(async (image) => {
        await deleteFromS3(image.url);
      })
    );

    await product.deleteOne();
    sendResponse(res, 200, true, "Product deleted successfully");
  } catch (error) {
    console.error("Error deleting product:", error);
    sendResponse(res, 500, false, "Error deleting product", {
      details: error.message,
    });
  }
};

const checkProductIdUnique = async (req, res) => {
  console.log(req.query);
  console.log(req.query);
  try {
    const { id } = req.query;

    if (!id) {
      return sendResponse(res, 400, false, "Product ID is required");
    }

    const existingProduct = await ProductModel.findOne({
      "basicDetails.id": id,
    });

    const isUnique = !existingProduct;

    sendResponse(res, 200, true, "Product ID check completed", {
      isUnique,
      message: isUnique
        ? "Product ID is available"
        : "Product ID already exists",
    });
  } catch (error) {
    console.error("Error checking product ID:", error);
    sendResponse(res, 500, false, "Error checking product ID", {
      details: error.message,
    });
  }
};

const checkSlugUnique = async (req, res) => {
  try {
    const { slug } = req.query;

    if (!slug) {
      return sendResponse(res, 400, false, "Slug is required");
    }

    const existingProduct = await ProductModel.findOne({
      "basicDetails.slug": slug,
    });

    const isUnique = !existingProduct;

    sendResponse(res, 200, true, "Slug check completed", {
      isUnique,
      message: isUnique ? "Slug is available" : "Slug already exists",
    });
  } catch (error) {
    console.error("Error checking slug:", error);
    sendResponse(res, 500, false, "Error checking slug", {
      details: error.message,
    });
  }
};

const getAllCompanyProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, searchTerm = "" } = req.query;

    const ownerId = req.user?.id;

    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query object with ownerId
    const query = { ownerId };

    // Search functionality
    if (searchTerm) {
      query.$and = [
        { ownerId }, // Ensure ownerId is always part of the query
        {
          $or: [
            { "basicDetails.name": { $regex: searchTerm, $options: "i" } },
            { "basicDetails.id": { $regex: searchTerm, $options: "i" } },
            { "basicDetails.slug": { $regex: searchTerm, $options: "i" } },
            {
              "basicDetails.description": { $regex: searchTerm, $options: "i" },
            },
          ],
        },
      ];
    }

    // Execute query with pagination
    const products = await ProductModel.find(query)
      .select("basicDetails images status block createdAt updatedAt") // Include block in the select
      .sort({ createdAt: -1 }) // Sort by creation date
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const totalProducts = await ProductModel.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limitNum);

    // Date formatter for 'dd-mm-yy'
    const formatDate = (date) => {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(date));
    };

    // Transform the data for response
    const transformedProducts = products.map((product) => ({
      id: product._id,
      block: {
        isBlocked: product.block.isBlocked,
        reason: product.block.reason,
        blockedBy: product.block.blockedBy,
        blockedAt: product.block.blockedAt
          ? formatDate(product.block.blockedAt)
          : null,
      },
      status: product.status,
      productId: product.basicDetails.id,
      name: product.basicDetails.name,
      slug: product.basicDetails.slug,
      price: product.basicDetails.price,
      description: product.basicDetails.description,
      image: product.images[0]?.url || null,
      image1: product.images[1]?.url || null,
      image2: product.images[2]?.url || null,
      image3: product.images[3]?.url || null,
      createdAt: formatDate(product.createdAt),
      updatedAt: formatDate(product.updatedAt),
    }));

    sendResponse(res, 200, true, "Products fetched successfully", {
      products: transformedProducts,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalProducts,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    sendResponse(res, 500, false, "Error fetching products", {
      details: error.message,
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    const ownerId = req.user.id;

    // Find product with both productId and ownerId to ensure ownership
    const product = await ProductModel.findOne({
      _id: productId,
      ownerId,
    });

    // Check if product exists and belongs to the user
    if (!product) {
      return sendResponse(res, 404, false, "Product not found", null);
    }

    // Transform the data for response
    const transformedProduct = {
      id: product._id,
      status: product.status,
      block: product.block,
      category: product.category,
      basicDetails: product.basicDetails,
      colors: product.colors,
      attributes: product.attributes,
      opportunities: product.opportunities,
      images: product.images,
      dynamicSteps: product.dynamicSteps,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    sendResponse(res, 200, true, "Product fetched successfully", {
      product: transformedProduct,
    });
  } catch (error) {
    console.error("Error fetching product:", error);

    // Handle specific MongoDB invalid ObjectId error
    if (error.name === "CastError" && error.kind === "ObjectId") {
      return sendResponse(res, 400, false, "Invalid product ID format", null);
    }

    sendResponse(res, 500, false, "Error fetching product", {
      details: error.message,
      details: error.message,
    });
  }
};

const getCompanyProducts = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const {
      page = 1,
      limit = 10,
      search = "",
      categoryId,
      subCategoryId,
    } = req.query;

    if (!ownerId) {
      return sendResponse(res, 400, "Owner ID is required");
    }

    // Verify owner existence
    const customer = await CustomerModel.findById(ownerId).exec();
    if (!customer) {
      return sendResponse(res, 404, "Customer not found");
    }

    // Build query to fetch products for the given ownerId
    const query = {
      ownerId,
      status: "Active",
      "block.isBlocked": false,
    };
    if (search) {
      query.$or = [
        { "basicDetails.name": { $regex: search, $options: "i" } },
        { "basicDetails.description": { $regex: search, $options: "i" } },
      ];
    }

    if (categoryId) {
      query["category.categoryId"] = mongoose.Types.ObjectId(categoryId);
    }

    if (subCategoryId) {
      query["category.subCategoryId"] = mongoose.Types.ObjectId(subCategoryId);
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Fetch products
    const products = await ProductModel.find(query)
      .skip(skip)
      .limit(Number(limit))
      .exec();

    const totalProducts = await ProductModel.countDocuments(query);

    // Fetch categories
    const categories = await CategoryModel.find({ isActive: true }).exec();
    const transformedCategories = categories.map((category) => ({
      id: category._id,
      name: category.categoryName,
      subcategories: category.subCategories
        .filter((sub) => sub.isActive)
        .map((sub) => ({
          id: sub._id,
          name: sub.name,
        })),
    }));

    // Transform products
    const transformedProducts = products.map((prod) => ({
      id: prod._id,
      name: prod.basicDetails.name || "Unknown Product",
      description: prod.basicDetails.description || "No Description",
      price: prod.basicDetails.price || "N/A",
      slug: prod.basicDetails.slug,
      primaryImage: prod.images[0]?.url || "/no-image.png",
      secondaryImage: prod.images[1]?.url || "/no-image.png",
      thirdImage: prod.images[2]?.url || "/no-image.png",
      fourthImage: prod.images[3]?.url || "/no-image.png",
      categoryId: prod.category.categoryId,
      subCategoryId: prod.category.subCategoryId,
    }));

    // Send response with products and categories
    return sendResponse(
      res,
      200,
      "Products and categories fetched successfully",
      {
        customer: { ...customer._doc },
        products: transformedProducts,
        categories: transformedCategories,
        pagination: {
          total: totalProducts,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(totalProducts / limit),
        },
      }
    );
  } catch (error) {
    console.error("Error fetching products and categories:", error.message);
    return sendResponse(res, 500, "Internal Server Error", {
      details: error.message,
    });
  }
};

const addProductImage = async (req, res) => {
  try {
    const { productId } = req.params;
    const ownerId = req.user.id;

    // Check if product exists and belongs to user
    const product = await ProductModel.findOne({ _id: productId, ownerId });
    if (!product) {
      return sendResponse(res, 404, false, "Product not found");
    }

    // Check if product already has 4 images
    if (product.images.length >= 4) {
      return sendResponse(res, 400, false, "Maximum 4 images allowed");
    }

    // Upload image to S3
    if (!req.file) {
      return sendResponse(res, 400, false, "No image file provided");
    }

    const { url, filename } = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "products"
    );

    // Add new image to product
    const newImage = {
      url,
      publicId: filename,
    };

    product.images.push(newImage);
    await product.save();

    sendResponse(res, 200, true, "Image added successfully", {
      _id: product.images[product.images.length - 1]._id,
      url,
      publicId: filename,
    });
  } catch (error) {
    console.error("Error adding product image:", error);
    sendResponse(res, 500, false, "Error adding product image", {
      details: error.message,
    });
  }
};

/**
 * Delete an image from a product
 * @param {Object} req - request object
 * @param {Object} res - response object
 */
const deleteProductImage = async (req, res) => {
  try {
    console.log("hi");
    const { productId, imageId } = req.params;
    const ownerId = req.user.id;

    // Check if product exists and belongs to user
    const product = await ProductModel.findOne({ _id: productId, ownerId });
    if (!product) {
      return sendResponse(res, 404, false, "Product not found");
    }

    // Find the image in the product
    const image = product.images.id(imageId);
    if (!image) {
      return sendResponse(res, 404, false, "Image not found");
    }

    // Delete from S3
    await deleteFromS3(image.publicId);

    // Remove image from product
    product.images.pull(imageId);
    await product.save();

    sendResponse(res, 200, true, "Image deleted successfully");
  } catch (error) {
    console.error("Error deleting product image:", error);
    sendResponse(res, 500, false, "Error deleting product image", {
      details: error.message,
    });
  }
};

const getTotalViewsAndNewVisits = async (req, res) => {
  try {
    // Get the ownerId from the authenticated user
    const ownerId = req.user.id;

    // Get all products owned by this user
    const products = await ProductModel.find({ ownerId });

    // Calculate total views from all products
    const totalViews = products.reduce(
      (sum, product) => sum + (product.totalViews || 0),
      0
    );

    // Get product IDs for visited logs query
    const productIds = products.map((product) => product._id);

    // Get visited logs for all products
    const visitedLogs = await VisitedLogModel.find({
      productId: { $in: productIds },
    });

    // Count unique visitors (new visits), excluding the owner
    const uniqueUsers = new Set();
    visitedLogs.forEach((log) => {
      log.users.forEach((user) => {
        // Only add to uniqueUsers if the user is not the owner
        if (user.userId && user.userId.toString() !== ownerId.toString()) {
          uniqueUsers.add(user.userId.toString());
        }
      });
    });

    res.status(200).json({
      success: true,
      data: {
        totalViews,
        newVisits: uniqueUsers.size,
        totalProducts: products.length,
      },
    });
  } catch (error) {
    console.error("Error getting views and visits:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product statistics",
      error: error.message,
    });
  }
};

const getSingleProductViewsAndVisits = async (req, res) => {
  try {
    const { productId } = req.params;
    const ownerId = req.user.id;

    // Get the product and verify ownership
    const product = await ProductModel.findOne({ _id: productId, ownerId });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unauthorized",
      });
    }

    // Get total views from the product
    const totalViews = product.totalViews || 0;

    // Get visited logs for this product
    const visitedLog = await VisitedLogModel.findOne({
      productId: product._id,
    });

    // Count unique visitors (new visits)
    const uniqueUsers = new Set();
    if (visitedLog) {
      visitedLog.users.forEach((user) => {
        if (user.userId) {
          uniqueUsers.add(user.userId.toString());
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        productName: product.basicDetails.name,
        totalViews,
        newVisits: uniqueUsers.size,
        // You can add more product-specific details here if needed
      },
    });
  } catch (error) {
    console.error("Error getting single product statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product statistics",
      error: error.message,
    });
  }
};

const getVisitorInsights = async (req, res) => {
  try {
    const { timeRange = "week" } = req.query;
    const userId = req.user.id;

    // Calculate date range
    const endDate = new Date();
    let startDate = new Date();

    switch (timeRange) {
      case "week":
        startDate.setDate(endDate.getDate() - 6);
        break;
      case "month":
        startDate.setDate(endDate.getDate() - 29);
        break;
      case "year":
        startDate.setMonth(endDate.getMonth() - 11);
        break;
      default:
        startDate.setDate(endDate.getDate() - 6);
    }

    // First, get all products owned by the user
    const userProducts = await ProductModel.find(
      { ownerId: userId },
      { _id: 1, totalViews: 1 }
    );

    const productIds = userProducts.map((product) => product._id);

    // Generate date labels
    const labels = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      labels.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate visitor data
    const visitorStats = await VisitedLogModel.aggregate([
      {
        $match: {
          productId: { $in: productIds },
          "users.time": { $gte: startDate, $lte: endDate },
        },
      },
      {
        $unwind: "$users",
      },
      {
        $match: {
          "users.time": { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$users.time",
              },
            },
            productId: "$productId",
          },
          dailyVisits: { $sum: 1 },
          uniqueVisitors: { $addToSet: "$users.userId" },
          locations: {
            $addToSet: "$users.coordinates",
          },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          totalVisits: { $sum: "$dailyVisits" },
          uniqueVisitors: { $addToSet: "$uniqueVisitors" },
          locations: { $push: "$locations" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Process the data
    const processedData = {
      newVisits: new Array(labels.length).fill(0),
      totalVisits: new Array(labels.length).fill(0),
      locations: new Set(),
    };

    // Map the aggregated data to our arrays
    visitorStats.forEach((stat) => {
      const index = labels.indexOf(stat._id);
      if (index !== -1) {
        processedData.newVisits[index] = stat.uniqueVisitors.flat().length;
        processedData.totalVisits[index] = stat.totalVisits;

        // Fixed location processing
        stat.locations.forEach((location) => {
          if (location && location.locationDetails) {
            const locationData = {
              city: location.locationDetails.city,
              state: location.locationDetails.state,
              coordinates: {
                latitude: location.latitude,
                longitude: location.longitude,
              },
            };
            if (locationData.city && locationData.coordinates.latitude) {
              processedData.locations.add(JSON.stringify(locationData));
            }
          }
        });
      }
    });

    // Calculate total views from products
    const totalProductViews = userProducts.reduce(
      (sum, product) => sum + (product.totalViews || 0),
      0
    );

    // Prepare the response
    const response = {
      success: true,
      data: {
        analyticsData: {
          labels,
          datasets: [
            {
              newVisits: processedData.newVisits,
              totalVisits: processedData.totalVisits,
            },
          ],
          summary: {
            totalVisits: totalProductViews,
            totalUniqueVisits: new Set(
              visitorStats.flatMap((stat) => stat.uniqueVisitors.flat())
            ).size,
          },
        },
        locationData: Array.from(processedData.locations).map((loc) =>
          JSON.parse(loc)
        ),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching visitor insights:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching visitor insights",
      error: error.message,
    });
  }
};

// const getOwnerProductViewLocations = async (req, res) => {
//   try {
//     const ownerId = req.user.id;

//     // Convert ownerId to ObjectId
//     const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

//     // First, find all products owned by the user
//     const ownedProducts = await ProductModel.find({ ownerId: ownerObjectId });

//     // Extract product IDs
//     const ownedProductIds = ownedProducts.map((product) => product._id);

//     console.log("Owned Product IDs:", ownedProductIds);
//     console.log("Number of Owned Products:", ownedProductIds.length);

//     // Aggregate view locations for owned products
//     const viewData = await VisitedLogModel.aggregate([
//       {
//         $match: {
//           productId: { $in: ownedProductIds },
//         },
//       },
//       {
//         $unwind: {
//           path: "$users",
//           preserveNullAndEmptyArrays: true,
//         },
//       },
//       {
//         $lookup: {
//           from: "products",
//           localField: "productId",
//           foreignField: "_id",
//           as: "product",
//         },
//       },
//       { $unwind: "$product" },
//       {
//         $group: {
//           _id: {
//             productId: "$productId",
//             city: "$users.coordinates.locationDetails.city",
//             latitude: "$users.coordinates.latitude",
//             longitude: "$users.coordinates.longitude",
//             state: "$users.coordinates.locationDetails.state",
//           },
//           count: { $sum: 1 },
//           lastViewed: { $max: "$users.time" },
//           productName: { $first: "$product.name" },
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           productId: "$_id.productId",
//           productName: 1,
//           city: "$_id.city",
//           state: "$_id.state",
//           latitude: "$_id.latitude",
//           longitude: "$_id.longitude",
//           viewCount: "$count",
//           lastViewed: 1,
//         },
//       },
//     ]);

//     console.log("View Data:", viewData);

//     res.status(200).json({
//       success: true,
//       data: viewData,
//       ownedProductsCount: ownedProducts.length,
//     });
//   } catch (error) {
//     console.error("Owner product view locations error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching owner product view locations",
//       error: error.message,
//     });
//   }
// };

const getOwnerProductViewLocations = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Convert ownerId to ObjectId
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    // First, find all products owned by the user with their names
    const ownedProducts = await ProductModel.find(
      { ownerId: ownerObjectId },
      "_id name"
    );

    // Extract product IDs
    const ownedProductIds = ownedProducts.map((product) => product._id);

    console.log("Owned Product IDs:", ownedProductIds);
    console.log("Number of Owned Products:", ownedProductIds.length);

    // Aggregate view locations for owned products
    const viewData = await VisitedLogModel.aggregate([
      {
        $match: {
          productId: { $in: ownedProductIds },
        },
      },
      {
        $unwind: {
          path: "$users",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: {
            productId: "$productId",
            city: "$users.coordinates.locationDetails.city",
            latitude: "$users.coordinates.latitude",
            longitude: "$users.coordinates.longitude",
            state: "$users.coordinates.locationDetails.state",
          },
          count: { $sum: 1 },
          lastViewed: { $max: "$users.time" },
          productName: { $first: "$product.name" },
        },
      },
      {
        $project: {
          _id: 0,
          productId: "$_id.productId",
          productName: 1,
          city: "$_id.city",
          state: "$_id.state",
          latitude: "$_id.latitude",
          longitude: "$_id.longitude",
          viewCount: "$count",
          lastViewed: 1,
        },
      },
    ]);

    console.log("View Data:", viewData);

    // Create a map of product names for easy reference
    const productNames = ownedProducts.reduce((acc, product) => {
      acc[product._id.toString()] = product.name;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: viewData,
      ownedProductsCount: ownedProducts.length,
      productNames: productNames, // Add this for frontend to map product IDs to names
    });
  } catch (error) {
    console.error("Owner product view locations error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching owner product view locations",
      error: error.message,
    });
  }
};

// controllers/companyProductController.js
const getProductNames = async (req, res) => {
  try {
    // Get product IDs from query string and parse them
    const productIds = req.query.productIds.split(",");

    // Validate if we have product IDs
    if (!productIds || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No product IDs provided",
      });
    }

    // Find products with the given IDs
    const products = await ProductModel.find(
      {
        _id: { $in: productIds },
        ownerId: req.user.id, // Make sure this matches your model's field
      },
      {
        "basicDetails.name": 1,
        _id: 1,
      }
    );

    // Create a map of productId to product name
    const productNames = products.reduce((acc, product) => {
      acc[product._id.toString()] = product.basicDetails.name;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: productNames,
    });
  } catch (error) {
    console.error("Error fetching product names:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching product names",
      error: error.message,
    });
  }
};

const toggleVisibility = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await ProductModel.findById(id);

    if (!product) {
      console.warn(`Product with ID ${id} not found.`);
      return res.status(404).json({ message: "Product not found" });
    }

    // Toggle status between Active and In_Active
    if (product.status === "Active") {
      product.status = "In_Active";
      console.log(`Deactivating product: ${id}`);
    } else {
      product.status = "Active";
      console.log(`Activating product: ${id}`);
    }

    const updatedProduct = await product.save();

    console.log(
      `Product status toggled successfully for ID: ${updatedProduct._id}`
    );
    return res.status(200).json({
      message:
        product.status === "In_Active"
          ? "Product deactivated successfully"
          : "Product activated successfully",
      product: {
        id: updatedProduct._id,
        status: updatedProduct.status,
      },
    });
  } catch (error) {
    console.error("Error toggling product status:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Controller function to get product stats (share count, total views, and total enquiries)
const getProductStats = async (req, res) => {
  const { id } = req.params; // Get the product ID from params

  try {
    // Aggregation to get product stats
    const productStats = await ProductModel.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(id) }, // Match the product by ID
      },
      {
        $project: {
          _id: 1,
          totalViews: 1,
          shareCount: 1,
        },
      },
      {
        $lookup: {
          from: "enquiries", // Lookup the Enquiry model (MongoDB collection)
          localField: "_id", // Field in Product model to join with
          foreignField: "productId", // Field in Enquiry model to join with
          as: "enquiries", // Output the result in a new "enquiries" field
        },
      },
      {
        $project: {
          totalViews: 1,
          shareCount: 1,
          totalEnquiries: { $size: "$enquiries" }, // Get the count of enquiries
        },
      },
    ]);

    if (productStats.length === 0) {
      return sendResponse(res, 404, "Product not found");
    }

    // Return product stats using sendResponse
    return sendResponse(res, 200, "Product stats fetched successfully", {
      productId: id,
      totalViews: productStats[0].totalViews,
      shareCount: productStats[0].shareCount,
      totalEnquiries: productStats[0].totalEnquiries,
    });
  } catch (error) {
    console.error("Error fetching product stats:", error);
    return sendResponse(res, 500, "Server error");
  }
};

const getCompanyProductsIds = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return sendResponse(res, 400, false, "User ID is required");
    }

    const products = await ProductModel.find({ companyId: userId }).sort({
      createdAt: -1,
    });

    return sendResponse(res, 200, true, "Products fetched successfully", {
      products,
    });
  } catch (error) {
    console.error("Error fetching company products:", error);
    return sendResponse(res, 500, false, "Internal Server Error");
  }
};

const assignProducts = async (req, res) => {
  try {
    const { productIds, influencerId } = req.body;

    // Validate inputs
    if (!productIds || !productIds.length || !influencerId) {
      return res.status(400).json({
        success: false,
        message: "Product IDs and influencer ID are required",
      });
    }

    // Update each product with the influencer assignment
    const updatePromises = productIds.map(async (productId) => {
      const product = await ProductModel.findById(productId);

      if (!product) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      // Add new assignment to productAssign array
      product.productAssign.push({
        influencerId: influencerId,
        status: "accepted",
        assignedDate: new Date(),
      });

      return product.save();
    });

    await Promise.all(updatePromises);

    return res.status(200).json({
      success: true,
      message: "Products assigned successfully",
    });
  } catch (error) {
    console.error("Error in assignProducts:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error assigning products",
    });
  }
};

module.exports = {
  test,
  createProduct,
  deleteProduct,
  checkSlugUnique,
  checkProductIdUnique,
  getAllCompanyProducts,
  getProductById,
  getCompanyProducts,
  updateProduct,
  addProductImage,
  deleteProductImage,
  getTotalViewsAndNewVisits,
  getSingleProductViewsAndVisits,
  getVisitorInsights,
  getOwnerProductViewLocations,
  getProductNames,
  toggleVisibility,
  getProductStats,
  assignProducts
};
