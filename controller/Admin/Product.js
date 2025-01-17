const Customer = require("../../models/Customer");
const Product = require("../../models/Product");

const getAllProducts = async (req, res) => {
  try {
    // Extract ownerId from query params
    const { ownerId } = req.params;
    if (!ownerId) {
      return res.status(400).json({
        success: false,
        message: "Owner ID is required",
      });
    }

    // Pagination
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    // Sorting
    const sortField = req.query.sort || "-createdAt";
    const sortOrder = sortField.startsWith("-") ? -1 : 1;
    const sortBy = sortField.replace("-", "");

    // Search
    const search = req.query.search?.trim() || "";
    const searchQuery = search
      ? {
          $or: [
            { "basicDetails.name": { $regex: search, $options: "i" } },
            { "basicDetails.description": { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // Fetch products by ownerId
    const products = await Product.find({
      ownerId,
      ...searchQuery,
    })
      .select({
        basicDetails: 1,
        images: 1,
        colors: 1,
        attributes: 1,
        category: 1,
        status: 1,
        totalViews: 1,
        createdAt: 1,
        opportunities: 1,
      })
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments({
      ownerId,
      ...searchQuery,
    });

    // Format products
    const formattedProducts = products.map((product) => ({
      id: product._id,
      basicDetails: {
        id: product.basicDetails.id,
        name: product.basicDetails.name,
        slug: product.basicDetails.slug,
        price: product.basicDetails.price,
        description: product.basicDetails.description,
      },
      images: product.images.map((image) => ({
        url: image.url,
        publicId: image.publicId,
      })),
      colors: product.colors.map((color) => ({
        name: color.name,
        price: color.price,
        images: color.images,
      })),
      attributes: product.attributes.map((attr) => ({
        name: attr.name,
        price: attr.price,
      })),
      category: product.category,
      status: product.status,
      totalViews: product.totalViews,
      opportunities: product.opportunities,
      createdAt: product.createdAt,
      formattedDate: new Date(product.createdAt).toLocaleDateString(),
    }));

    // Handle no products found
    if (!formattedProducts.length) {
      return res.status(404).json({
        success: false,
        message: "No products found",
        metadata: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      metadata: {
        total,
        count: formattedProducts.length,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
        search: search || undefined,
      },
      data: formattedProducts,
      links: {
        self: `/products?ownerId=${ownerId}&page=${page}&limit=${limit}`,
        first: `/products?ownerId=${ownerId}&page=1&limit=${limit}`,
        last: `/products?ownerId=${ownerId}&page=${Math.ceil(
          total / limit
        )}&limit=${limit}`,
        next:
          page * limit < total
            ? `/products?ownerId=${ownerId}&page=${page + 1}&limit=${limit}`
            : null,
        prev:
          page > 1
            ? `/products?ownerId=${ownerId}&page=${page - 1}&limit=${limit}`
            : null,
      },
    });
  } catch (error) {
    console.error("Get All Products Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    // First find the product
    const product = await Product.findOne({ "basicDetails.slug": slug })
      .populate("category.categoryId")
      .populate("category.subCategoryId")
      .populate({
        path: "ownerId",
        select: "name email profile companyDetails isCompany status",
        populate: {
          path: "companyDetails",
          select: "companyInfo contactInfo companyLogo documents",
        },
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Format the response
    const formattedProduct = {
      id: product._id,
      status: product.status,
      owner: {
        id: product.ownerId._id,
        name: product.ownerId.name,
        email: product.ownerId.email,
        profile: product.ownerId.profile,
        status: product.ownerId.status,
        company: product.ownerId.isCompany.verified
          ? {
              info: {
                name: product.ownerId.companyDetails.companyInfo.companyName,
                owner: product.ownerId.companyDetails.companyInfo.ownerName,
                establishmentYear:
                  product.ownerId.companyDetails.companyInfo.yearEstablishment,
                gstNo: product.ownerId.companyDetails.companyInfo.gstNo,
                businessType:
                  product.ownerId.companyDetails.companyInfo.businessType,
                about: product.ownerId.companyDetails.companyInfo.companyAbout,
                employeeCount:
                  product.ownerId.companyDetails.companyInfo.totalEmployees,
              },
              contact: {
                address: product.ownerId.companyDetails.contactInfo.address,
                city: product.ownerId.companyDetails.contactInfo.city,
                state: product.ownerId.companyDetails.contactInfo.state,
                pincode: product.ownerId.companyDetails.contactInfo.pincode,
                email: product.ownerId.companyDetails.contactInfo.email,
                phone: product.ownerId.companyDetails.contactInfo.phone,
              },
              logo: product.ownerId.companyDetails.companyLogo,
              documents: product.ownerId.companyDetails.documents,
            }
          : null,
        isCompany: product.ownerId.isCompany,
      },
      basicDetails: {
        id: product.basicDetails.id,
        slug: product.basicDetails.slug,
        name: product.basicDetails.name,
        price: product.basicDetails.price,
        description: product.basicDetails.description,
      },
      images: product.images.map((image) => ({
        url: image.url,
        publicId: image.publicId,
      })),
      colors: product.colors.map((color) => ({
        name: color.name,
        price: color.price,
        images: color.images,
      })),
      attributes: product.attributes,
      category: product.category,
      dynamicSteps: product.dynamicSteps,
      opportunities: product.opportunities,
      totalViews: product.totalViews,
      block: product.block,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    return res.status(200).json({
      success: true,
      data: formattedProduct,
    });
  } catch (error) {
    console.error("Error in getProductBySlug:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "dsevelopment" ? error.message : undefined,
    });
  }
};

const updateProductStatus = async (req, res) => {
  try {
    const { productId } = req.params;
    const { isBlocked } = req.body;
    const userId = req.user._id;

    const product = await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          "block.isBlocked": isBlocked,
          "block.blockedAt": isBlocked ? new Date() : null,
          "block.blockedBy": isBlocked ? userId : null,
          status: isBlocked ? "In_Active" : "Active",
        },
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Product ${isBlocked ? "blocked" : "unblocked"} successfully`,
      data: product,
    });
  } catch (error) {
    console.error("Error updating product status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update product status",
      error: error.message,
    });
  }
};

module.exports = { getAllProducts, getProductBySlug, updateProductStatus };
