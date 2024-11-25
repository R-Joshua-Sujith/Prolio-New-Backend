const ProductModel = require("../../models/Product");
const CustomerModel = require("../../models/Customer");
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");
const { default: mongoose } = require("mongoose");

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
        { 'basicDetails.id': formData.basicDetails.id },
        { 'basicDetails.slug': formData.basicDetails.slug }
      ]
    });

    if (existingProduct) {
      const duplicateField = existingProduct.basicDetails.id === formData.basicDetails.id ? 'id' : 'slug';
      return sendResponse(res, 400, false, `Product with this ${duplicateField} already exists`);
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

// Controller function to fetch all products
const getAllProducts = async (req, res) => {
  try {
    const {
      searchTerm = "",
      page = 1,
      limit = 10,
      category,
      subcategory,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    let query = {};

    if (searchTerm) {
      query.$or = [
        { "basicDetails.name": { $regex: searchTerm, $options: "i" } },
        { "basicDetails.description": { $regex: searchTerm, $options: "i" } },
      ];
    }

    if (category) {
      query["category.categoryId"] = category;
    }
    if (subcategory) {
      query["category.subCategoryId"] = subcategory;
    }

    const products = await ProductModel.find(query)
      .populate("category.categoryId", "name")
      .skip(skip)
      .limit(limitNum);

    const totalProducts = await ProductModel.countDocuments(query);
    const categories = await ProductModel.distinct("category.categoryId");
    const subcategories = await ProductModel.distinct("category.subCategoryId");

    const transformedData = products.map((product) => {
      const primaryImage = product.images[0]?.url || "No Image Available";
      const secondaryImage = product.images[1]?.url || "No Secondary Image";

      const price = product.basicDetails.price || "Price not available";

      return {
        id: product._id,
        userId: product.ownerId,
        companyId: product.companyId?._id || null,
        productName: product.basicDetails.name || "Unknown Product",
        slug: product.basicDetails.slug,
        brandName: product.companyId?.companyName || "Unknown Company",
        price,
        productImage: primaryImage,
        secondaryProductImage: secondaryImage,
        category: product.category.categoryId?.name || "Unknown Category",
        subcategory: product.category.subCategoryId || "Unknown Subcategory",
      };
    });

    const totalPages = Math.ceil(totalProducts / limitNum);

    res.status(200).json({
      products: transformedData,
      totalItems: totalProducts,
      totalPages,
      currentPage: pageNum,
      categories,
      subcategories,
    });
  } catch (error) {
    console.error("Error fetching product details:", error.message);

    if (error instanceof mongoose.Error) {
      return res
        .status(400)
        .json({ error: "Database Error", details: error.message });
    }

    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};


const checkProductIdUnique = async (req, res) => {
  console.log(req.query)
  try {
    const { id } = req.query;

    if (!id) {
      return sendResponse(res, 400, false, "Product ID is required");
    }

    const existingProduct = await ProductModel.findOne({
      'basicDetails.id': id
    });

    const isUnique = !existingProduct;

    sendResponse(res, 200, true, "Product ID check completed", {
      isUnique,
      message: isUnique ? "Product ID is available" : "Product ID already exists"
    });

  } catch (error) {
    console.error("Error checking product ID:", error);
    sendResponse(res, 500, false, "Error checking product ID", {
      details: error.message
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
      'basicDetails.slug': slug
    });

    const isUnique = !existingProduct;

    sendResponse(res, 200, true, "Slug check completed", {
      isUnique,
      message: isUnique ? "Slug is available" : "Slug already exists"
    });

  } catch (error) {
    console.error("Error checking slug:", error);
    sendResponse(res, 500, false, "Error checking slug", {
      details: error.message
    });
  }
};

const getAllCompanyProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
    } = req.query;

    const ownerId = req.user.id; // Get ownerId from route parameters
    // Or if you're passing it in query: const { ownerId } = req.query;

    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query object with ownerId
    let query = { ownerId }; // Add ownerId to base query

    // Search functionality
    if (search) {
      query.$and = [ // Use $and to combine ownerId and search conditions
        { ownerId },
        {
          $or: [
            { "basicDetails.name": { $regex: search, $options: "i" } },
            { "basicDetails.id": { $regex: search, $options: "i" } },
            { "basicDetails.slug": { $regex: search, $options: "i" } },
            { "basicDetails.description": { $regex: search, $options: "i" } }
          ]
        }
      ];
    }

    // Execute query with pagination
    const products = await ProductModel.find(query)
      .select('basicDetails images') // Only select the fields we need
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const totalProducts = await ProductModel.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limitNum);

    // Transform the data for response
    const transformedProducts = products.map(product => ({
      id: product._id,
      productId: product.basicDetails.id,
      name: product.basicDetails.name,
      slug: product.basicDetails.slug,
      price: product.basicDetails.price,
      description: product.basicDetails.description,
      image: product.images[0]?.url || null, // Get only the first image URL
    }));

    sendResponse(res, 200, true, "Products fetched successfully", {
      products: transformedProducts,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalProducts,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });

  } catch (error) {
    console.error("Error fetching products:", error);
    sendResponse(res, 500, false, "Error fetching products", {
      details: error.message
    });
  }
};

const getProductById = async (req, res) => {
  console.log("hi")
  try {
    const { productId } = req.params;
    const ownerId = req.user.id;

    // Find product with both productId and ownerId to ensure ownership
    const product = await ProductModel.findOne({
      _id: productId,
      ownerId
    });

    // Check if product exists and belongs to the user
    if (!product) {
      return sendResponse(res, 404, false, "Product not found", null);
    }

    // Transform the data for response
    const transformedProduct = {
      id: product._id,
      category: product.category,
      basicDetails: product.basicDetails,
      colors: product.colors,
      attributes: product.attributes,
      opportunities: product.opportunities,
      images: product.images,
      dynamicSteps: product.dynamicSteps,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };

    sendResponse(res, 200, true, "Product fetched successfully", {
      product: transformedProduct
    });

  } catch (error) {
    console.error("Error fetching product:", error);

    // Handle specific MongoDB invalid ObjectId error
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return sendResponse(res, 400, false, "Invalid product ID format", null);
    }

    sendResponse(res, 500, false, "Error fetching product", {
      details: error.message
    });
  }
};




module.exports = {
  test,
  createProduct,
  deleteProduct,
  getAllProducts,
  checkSlugUnique,
  checkProductIdUnique,
  getAllCompanyProducts,
  getProductById
};
