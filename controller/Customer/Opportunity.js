const OpportunityModel = require("../../models/Opportunity");
const CustomerModel = require("../../models/Customer");
const Product = require("../../models/Product");
const mongoose = require("mongoose");
const { uploadToS3 } = require("../../utils/s3FileUploader");
const { ObjectId } = mongoose.Types;

// CREATE OPPURTUNITY
const submitOpportunity = async (req, res) => {
  try {
    const {
      productId,
      opportunity_role,
      mobileNumber,
      name,
      address,
      yearsOfExp,
      memo,
      email,
      productsDealtWith,
    } = req.body;

    const customerId = req.user.id;

    // Input validations
    const errors = [];

    if (!productId)
      errors.push({ field: "productId", message: "Product ID is required." });
    if (!opportunity_role)
      errors.push({
        field: "opportunity_role",
        message: "Opportunity role is required.",
      });
    if (!name) errors.push({ field: "name", message: "Name is required." });
    if (!address)
      errors.push({ field: "address", message: "Address is required." });
   
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors,
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // Handle file uploads
    let uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      const uniqueFiles = Array.from(
        new Set(req.files.map((f) => f.originalname))
      ).map((name) => req.files.find((f) => f.originalname === name));

      uploadedFiles = await Promise.all(
        uniqueFiles.map(async (file) => {
          const uploadResult = await uploadToS3(
            file.buffer,
            file.originalname,
            file.mimetype,
            "opportunities"
          );
          // Assuming uploadToS3 returns an object with URL and filename
          return {
            url: uploadResult.url, // The URL of the uploaded file
            publicId: uploadResult.filename, // The identifier for the file
          };
        })
      );
    }

    // Create new opportunity
    const newOpportunity = new OpportunityModel({
      customerId,
      ownerId: product.ownerId,
      name,
      mobileNumber,
      productId,
      opportunity_role,
      address,
      yearsOfExp,
      memo,
      email,
      productsDealtWith,
      status: "Processing",
      documents: uploadedFiles, // Array of S3 URLs
    });

    await newOpportunity.save();

    res.status(201).json({
      success: true,
      message: "Opportunity created successfully.",
      opportunity: newOpportunity,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error.",
      error: error.message,
    });
  }
};

// VIEW SENT OPPURTUNITY
const viewSingleOpportunity = async (req, res) => {
  try {
    const opportunityId = req.params.opportunityId;
    const loggedInUserId = req.user.id; // Adjust according to your auth setup

    // Find the opportunity
    const opportunity = await OpportunityModel.findOne({
      _id: opportunityId,
      customerId: loggedInUserId,
    })
      .populate("productId", "basicDetails description images")
      .populate("ownerId", "name email")
      .populate({ path: "customerId", select: "companyDetails email" })
      .exec();

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message:
          "Opportunity not found or you do not have permission to view it",
      });
    }

    res.status(200).json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    console.error("Error fetching opportunity:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const viewAllOpportunity = async (req, res) => {
  try {
    const loggedInUserId = req.user?.id;
    console.log("loggedInUserId", loggedInUserId);

    const opportunities = await OpportunityModel.find({
      customerId: loggedInUserId,
    })
      .populate({
        path: "productId",
        select: "basicDetails name description price",
        options: { strictPopulate: false },
      })
      .populate("ownerId", "name email")
      .exec();

    if (opportunities.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No opportunities found.",
        data: [],
      });
    }

    // Optional: Transform the data to ensure consistent structure
    const transformedOpportunities = opportunities.map((opportunity) => {
      return {
        ...opportunity.toObject(), // Convert to plain object
        productId: {
          _id: opportunity.productId?._id,
          basicDetails: opportunity.productId?.basicDetails,
          name: opportunity.productId?.name,
          description: opportunity.productId?.description,
          price: opportunity.productId?.price,
        },
      };
    });

    // Return the opportunities
    res.status(200).json({
      success: true,
      data: transformedOpportunities,
    });
  } catch (error) {
    console.error("Error fetching opportunities:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const checkApplicationStatus = async (req, res) => {
  try {
    const { productId } = req.query;
    const customerId = req.user._id; // Get from auth middleware

    // First check if the user is the product owner
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found"
      });
    }

    // Check if current user is the product owner
    const isOwner = product.ownerId.toString() === customerId.toString();
    if (isOwner) {
      return res.status(200).json({
        success: true,
        data: {
          isOwner: true
        }
      });
    }

    // If not owner, check for existing applications
    const applications = await OpportunityModel.find({
      productId,
      customerId
    }).lean();

    // Create status map for each role
    const statusMap = applications.reduce((acc, app) => {
      acc[app.opportunity_role] = app.status;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        isOwner: false,
        applications: statusMap
      }
    });

  } catch (error) {
    console.error("Error in checkApplicationStatus:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

module.exports = {
  submitOpportunity,
  viewSingleOpportunity,
  viewAllOpportunity,
  checkApplicationStatus,
};
