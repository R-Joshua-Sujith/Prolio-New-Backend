const CustomerModel = require("../../models/Customer");
const ProductModel = require("../../models/Product");
const CategoryModel = require("../../models/Category");
const VisitedLogModel = require("../../models/visitedLog");
const { saveVisitedLogs } = require("./Helpers/GeoLocation");
const { sendResponse } = require("../../utils/responseHandler");
const EnquiryModel = require("../../models/Enquiry");
const mongoose = require("mongoose");

const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();
exports.test = async (req, res) => {
  try {
    res.status(200).json({ message: "Product Success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getProduct = async (req, res) => {
  const { slug } = req.params;
  const { latitude, longitude } = req.query;

  const userId = req.user.id;
  try {
    // Find the product by slug
    const product = await ProductModel.findOne({
      "basicDetails.slug": slug,
    }).populate(
      "ownerId",
      "companyDetails.companyInfo companyDetails.contactInfo"
    );

    if (!product) {
      return res.status(400).json({ error: "Product Not Found" });
    }

    // Check for an existing enquiry for this product by the logged-in user (req.user)
    const enquiry = await EnquiryModel.findOne({
      productId: product._id,
      customerId: req.user?.id,
    });

    // Prepare response data
    const responseData = {
      product,
      enquiryStatus: enquiry ? enquiry.status : "No Enquiry Found",
    };

    saveVisitedLogs(latitude, longitude, userId, product._id);
    res.status(200).json(responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const {
      searchTerm = "",
      page = 1,
      limit = 10,
      category,
      subcategory,
      userId,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build query with more efficient filtering
    const query = {};

    // More efficient search using text index
    if (searchTerm) {
      query.$text = { $search: searchTerm };
    }

    if (category) {
      query["category.categoryId"] = category;
    }

    if (subcategory) {
      query["category.subCategoryId"] = subcategory;
    }

    // Perform parallel database operations
    const [products, totalProducts, allCategories] = await Promise.all([
      ProductModel.find(query)
        .select("basicDetails images category ownerId companyId")
        .populate({
          path: "ownerId",
          select: "companyDetails.companyInfo.companyName",
        })
        .skip(skip)
        .limit(limitNum),

      ProductModel.countDocuments(query),

      CategoryModel.find({}, "categoryName subCategories"),
    ]);

    // Create efficient maps for category lookup
    const categoryMap = new Map(
      allCategories.flatMap((category) => [
        [category._id.toString(), category.categoryName],
        ...category.subCategories.map((sub) => [sub._id.toString(), sub.name]),
      ])
    );

    // Skip fetching enquiries if userId is invalid or not provided
    let enquiryMap = new Map();
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      // Bulk fetch enquiries and optimize processing
      const productIds = products.map((product) => product._id);
      const enquiries = await EnquiryModel.find({
        productId: { $in: productIds },
        customerId: userId,
      });

      enquiryMap = new Map(
        enquiries.map((enquiry) => [
          enquiry.productId.toString(),
          enquiry.status,
        ])
      );
    }

    // Transform products more efficiently
    const transformedData = products.map((product) => ({
      id: product._id,
      userId: product.ownerId?._id,
      companyId: product.companyId?._id,
      productName: product.basicDetails?.name || "Unknown Product",
      slug: product.basicDetails?.slug,
      brandName:
        product.ownerId?.companyDetails?.companyInfo?.companyName ||
        "Unknown Company",
      price: product.basicDetails?.price || "Price not available",
      productImage: product.images?.[0]?.url || "No Image Available",
      secondaryImage: product.images?.[1]?.url || "No Secondary Image",
      thirdImage: product.images?.[2]?.url || "No Third Image",
      fourthImage: product.images?.[3]?.url || "No Fourth Image",
      category:
        categoryMap.get(product.category.categoryId?.toString()) ||
        "Unknown Category",
      subcategory:
        categoryMap.get(product.category.subCategoryId?.toString()) ||
        "Unknown Subcategory",
      enquiryStatus: enquiryMap.get(product._id.toString()) || "Not Enquired",
    }));

    return sendResponse(res, 200, "Products fetched successfully", {
      products: transformedData,
      totalItems: totalProducts,
      totalPages: Math.ceil(totalProducts / limitNum),
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      details: error.message,
    });
  }
};


exports.getSearchProducts = async (req, res) => {
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

    // Build query
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

    // Fetch all categories
    const allCategories = await CategoryModel.find(
      {},
      "categoryName subCategories"
    );

    // Create maps for quick lookup
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

    // Transform category and subcategory IDs to names
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
        // Fetch company name from Customer model
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
        const thirdImage = product.images[2]?.url || "No Third Image";
        const fourthImage = product.images[3]?.url || "No Fourth Image";

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
          thirdProductImage: thirdImage,
          fourthProductImage: fourthImage,
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