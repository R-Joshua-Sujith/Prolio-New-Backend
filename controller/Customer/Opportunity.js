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

//     // const customerId = req.user._id;
//     const customerId = req.user.id;

//     // Check if product exists
//     const product = await Product.findById(productId);
//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
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
    console.log("Product ID received:", req.body.productId);
    console.log("Body", req.body);

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Handle file uploads if any

    console.log(req.files);
    console.log(req.body);

    let uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      // Use Set to remove duplicate files
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
      message: "Opportunity created successfully",
      opportunity: newOpportunity,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// VIEW SENT OPPURTUNITY
const viewSingleOpportunity = async (req, res) => {
  try {
    // const opportunityId = req.params.opportunityId;
    const opportunityId = "6736fb11169ffb11879b0506";

    // Replace this with your actual way of getting the logged-in user's ID
    // const loggedInUserId = req.user._id; // Adjust according to your auth setup
    const loggedInUserId = "6735e1de6fc1600f43aea05d"; // Adjust according to your auth setup

    // Find the opportunity
    const opportunity = await OpportunityModel.findOne({
      _id: opportunityId,
      customerId: loggedInUserId, // Ensure the logged-in user is the sender
    })
      .populate("productId", "name description price") // Adjust fields as needed
      .populate("ownerId", "name email") // Adjust fields as needed
      .exec();

    // If no opportunity found
    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message:
          "Opportunity not found or you do not have permission to view it",
      });
    }

    // Return the opportunity
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
const viewAllOpportunity = async (req, res) => {
  try {
    // const loggedInUserId = req.user._id;
    const loggedInUserId = "6735e1de6fc1600f43aea05d";

    // Find all opportunities where the logged-in user is the sender
    const opportunities = await OpportunityModel.find({
      customerId: loggedInUserId,
    })
      .populate("productId", "name description price") // Adjust fields as needed
      .populate("ownerId", "name email") // Adjust fields as needed
      .exec();

    // Return the opportunities
    res.status(200).json({
      success: true,
      data: opportunities,
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
