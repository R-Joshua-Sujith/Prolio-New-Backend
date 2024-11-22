const OpportunityModel = require("../../models/Opportunity");
const CustomerModel = require("../../models/Customer");
const Product = require("../../models/Product");
const mongoose = require("mongoose");
const { uploadToS3 } = require("../../utils/s3FileUploader");

// CREATE OPPURTUNITY
// const submitOpportunity = async (req, res) => {
//   try {
//     const {
//       productId,
//       opportunity_role,
//       name,
//       address,
//       yearsOfExp,
//       memo,

//       productsDealtWith,
//     } = req.body;

//     const customerId = req.user.id;

//     // Check if product exists
//     const product = await Product.findById(productId);
//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }

//     let uploadedFiles = [];
//     if (req.files && req.files.length > 0) {
//       // Use Set to remove duplicate files
//       const uniqueFiles = Array.from(
//         new Set(req.files.map((f) => f.originalname))
//       ).map((name) => req.files.find((f) => f.originalname === name));

//       uploadedFiles = await Promise.all(
//         uniqueFiles.map(async (file) => {
//           const uploadResult = await uploadToS3(
//             file.buffer,
//             file.originalname,
//             file.mimetype,
//             "opportunities"
//           );
//           return uploadResult.url;
//         })
//       );
//     }

//     // Create new opportunity
//     const newOpportunity = new OpportunityModel({
//       customerId,
//       ownerId: product.ownerId,
//       name,
//       productId,
//       opportunity_role,
//       address,
//       yearsOfExp,
//       memo,
//       productsDealtWith,
//       status: "Processing",
//       documents: uploadedFiles, // Array of S3 URLs
//     });

//     await newOpportunity.save();

//     res.status(201).json({
//       message: "Opportunity created successfully",
//       opportunity: newOpportunity,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

const submitOpportunity = async (req, res) => {
  try {
    const {
      productId,
      opportunity_role,
      name,
      address,
      yearsOfExp,
      memo,
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
    if (!yearsOfExp)
      errors.push({
        field: "yearsOfExp",
        message: "Years of experience is required.",
      });
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
          return uploadResult.url;
        })
      );
    }

    // Create new opportunity
    const newOpportunity = new OpportunityModel({
      customerId,
      ownerId: product.ownerId,
      name,
      productId,
      opportunity_role,
      address,
      yearsOfExp,
      memo,
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
    // const opportunityId = req.params.opportunityId;
    const opportunityId = "6736fb11169ffb11879b0506";
    const loggedInUserId = req.user?.id;
    // Find the opportunity
    const opportunity = await OpportunityModel.findOne({
      _id: opportunityId,
      customerId: loggedInUserId,
    })
      .populate("productId", "name description price")
      .populate("ownerId", "name email")
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

//View-All SENT OPPURTUNITY
// const viewAllOpportunity = async (req, res) => {
//   try {
//     const loggedInUserId = req.user.id;

//     console.log(loggedInUserId);

//     // Find all opportunities where the logged-in user is the sender
//     const opportunities = await OpportunityModel.find({
//       customerId: loggedInUserId,
//     })
//       .populate("productId", "name description price") // Adjust fields as needed
//       .populate("ownerId", "name email") // Adjust fields as needed
//       .exec();

//     if (opportunities.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "No opportunities found.",
//         data: [],
//       });
//     }

//     // Return the opportunities
//     res.status(200).json({
//       success: true,
//       data: opportunities,
//     });
//   } catch (error) {
//     console.error("Error fetching opportunities:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

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

module.exports = {
  submitOpportunity,
  viewSingleOpportunity,
  viewAllOpportunity,
};
