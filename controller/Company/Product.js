const ProductModel = require("../../models/Product");
const CustomerModel = require("../../models/Customer");
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");
const { default: mongoose } = require("mongoose");
const CategoryModel = require("../../models/Category");
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

    console.log("hi", req.body);

    let ownerId = "6735e1fe6fc1600f43aea060";

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

    // Fetch products
    const products = await ProductModel.find(query).skip(skip).limit(limitNum);
    const totalProducts = await ProductModel.countDocuments(query);

    // Fetch all categories with subcategories
    const allCategories = await CategoryModel.find(
      {},
      "categoryName subCategories"
    );
    const categoryMap = new Map();
    const subcategoryMap = new Map();

    allCategories.forEach((category) => {
      categoryMap.set(category._id.toString(), category.categoryName);
      category.subCategories.forEach((sub) => {
        subcategoryMap.set(sub._id.toString(), sub.name);
      });
    });

    // Get distinct category and subcategory IDs
    const distinctCategoryIds = await ProductModel.distinct(
      "category.categoryId"
    );
    const distinctSubcategoryIds = await ProductModel.distinct(
      "category.subCategoryId"
    );

    const categories = distinctCategoryIds
      .map((id) => ({
        id: id,
        name: categoryMap.get(id.toString()) || "Unknown Category",
      }))
      .filter((cat) => cat.name !== "Unknown Category");

    const subcategories = distinctSubcategoryIds
      .map((id) => ({
        id: id,
        name: subcategoryMap.get(id.toString()) || "Unknown Subcategory",
      }))
      .filter((sub) => sub.name !== "Unknown Subcategory");

    // Fetch additional data for products
    const transformedData = await Promise.all(
      products.map(async (product) => {
        const customer = await CustomerModel.findOne(
          { _id: product.ownerId },
          "companyDetails.companyInfo.companyName"
        );
        const companyName =
          customer?.companyDetails?.companyInfo?.companyName ||
          "Unknown Company";

        // Get category and subcategory names from our maps
        const categoryName =
          categoryMap.get(product.category.categoryId?.toString()) ||
          "Unknown Category";
        const subcategoryName =
          subcategoryMap.get(product.category.subCategoryId?.toString()) ||
          "Unknown Subcategory";

        // Transform product data
        const primaryImage = product.images[0]?.url || "No Image Available";
        const secondaryImage = product.images[1]?.url || "No Secondary Image";
        const price = product.basicDetails.price || "Price not available";

        return {
          id: product._id,
          userId: product.ownerId,
          companyId: product.companyId?._id || null,
          productName: product.basicDetails.name || "Unknown Product",
          slug: product.basicDetails.slug,
          brandName: companyName,
          price,
          productImage: primaryImage,
          secondaryProductImage: secondaryImage,
          category: categoryName,
          subcategory: subcategoryName,
        };
      })
    );

    const totalPages = Math.ceil(totalProducts / limitNum);

    // Prepare response with named categories and subcategories
    return sendResponse(res, 200, "Products fetched successfully", {
      products: transformedData,
      totalItems: totalProducts,
      totalPages,
      currentPage: pageNum,
      categories: categories,
      subcategories: subcategories,
    });
  } catch (error) {
    console.error("Error fetching product details:", error.message);
    return sendResponse(res, 500, "Internal Server Error", {
      details: error.message,
    });
  }
};

module.exports = {
  test,
  createProduct,
  deleteProduct,
  getAllProducts,
};
