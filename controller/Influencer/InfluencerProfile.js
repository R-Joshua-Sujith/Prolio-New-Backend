const CustomerModel = require("../../models/Customer");
const { sendResponse } = require("../../utils/responseHandler");
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const ProductModel = require("../../models/Product");
const mongoose = require("mongoose");
const NotificationService = require("../../utils/notificationService");

// Controller function to register an influencer (with file upload handling)exports.
exports.registerInfluencer = async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log("Body:", req.body);
    const existingUser = await CustomerModel.findById(userId);

    if (!existingUser) {
      return sendResponse(
        res,
        404,
        false,
        "User not found. Please register first."
      );
    }

    if (existingUser.isInfluencer.applied) {
      return sendResponse(
        res,
        400,
        false,
        "User has already applied for influencer registration."
      );
    }

    // Parse the personal data from the request body
    const personalData = JSON.parse(req.body.personalData);

    const uploadedDocuments = [];

    // Handle file uploads
    if (req.files) {
      for (const [fieldName, fileArray] of Object.entries(req.files)) {
        for (const file of fileArray) {
          try {
            const uploadResponse = await uploadToS3(
              file.buffer,
              file.originalname,
              file.mimetype,
              "influencer-docs"
            );

            // Generate an ObjectId for the document
            uploadedDocuments.push({
              _id: new mongoose.Types.ObjectId(),
              type: fieldName,
              filename: uploadResponse.filename,
              url: uploadResponse.url,
              publicId: uploadResponse.filename,
            });
          } catch (uploadError) {
            console.error(`Error uploading ${fieldName}:`, uploadError);
            throw uploadError;
          }
        }
      }
    }

    // Update user with influencer details
    try {
      existingUser.isInfluencer.applied = true;
      existingUser.isInfluencer.verified = false;
      existingUser.influencerDetails = {
        // firstName: personalData.firstName,
        // lastName: personalData.lastName,
        // email: personalData.email,
        // mobileNumber: personalData.mobileNumber,
        address: personalData.address,
        country: personalData.country,
        city: personalData.city,
        state: personalData.state,
        pincode: personalData.pincode,
        bio: personalData.bio,
        socialMediaAccounts: personalData.socialHandles,
        documents: uploadedDocuments, // Store documents with ObjectId
      };

      await existingUser.save();

      return sendResponse(
        res,
        200,
        true,
        "Influencer application submitted successfully",
        existingUser
      );
    } catch (saveError) {
      // Cleanup uploaded documents if saving fails
      for (const doc of uploadedDocuments) {
        try {
          await deleteFromS3(doc.publicId);
        } catch (deleteError) {
          console.error("Cleanup error:", deleteError);
        }
      }
      throw saveError;
    }
  } catch (error) {
    console.error("General error:", error);
    return sendResponse(
      res,
      500,
      false,
      "Error processing influencer registration",
      error.message
    );
  }
};
exports.updateInfluencer = async (req, res) => {
  try {
    const userId = req.user?.id;
    const existingUser = await CustomerModel.findById(userId);

    if (!existingUser) {
      return sendResponse(res, 404, "User not found.");
    }

    if (!existingUser.isInfluencer.applied) {
      return sendResponse(
        res,
        400,
        "User has not applied for influencer registration yet."
      );
    }

    const {
      address,
      country,
      city,
      state,
      pincode,
      bio,
      socialMediaAccounts,
      documents,
    } = req.body;
    // Prepare to collect new uploaded documents
    const uploadedDocuments = [];

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const { buffer, originalname, mimetype } = file;

        // Upload the file to S3 and get the response
        const uploadResponse = await uploadToS3(
          buffer,
          originalname,
          mimetype,
          "influencer-docs"
        );

        // Add the uploaded document details to the list
        uploadedDocuments.push({
          _id: new mongoose.Types.ObjectId(),
          url: uploadResponse.url,
          publicId: uploadResponse.filename,
          type: req.body.documentType || "Other",
        });
      }
    }

    // Ensure we have the latest influencer details
    const currentInfluencerDetails = existingUser.influencerDetails || {};

    // Create update data, preserving existing social media accounts if not provided
    const updateData = {
      ...currentInfluencerDetails,
      address: address || currentInfluencerDetails.address,
      country: country || currentInfluencerDetails.country,
      city: city || currentInfluencerDetails.city,
      state: state || currentInfluencerDetails.state,
      pincode: pincode || currentInfluencerDetails.pincode,
      bio: bio || currentInfluencerDetails.bio,
    };

    // Handle Social Media Accounts
    const existingAccounts = currentInfluencerDetails.socialMediaAccounts || [];

    // Process Social Media Accounts
    let processedSocialMediaAccounts = [...existingAccounts];

    // Check if socialMediaAccounts is provided in the request
    if (socialMediaAccounts) {
      // Parse socialMediaAccounts if it's a string
      const incomingSocialAccounts =
        typeof socialMediaAccounts === "string"
          ? JSON.parse(socialMediaAccounts)
          : socialMediaAccounts;

      // Process and merge incoming accounts
      incomingSocialAccounts.forEach((account) => {
        // Validate required fields
        if (!account.platform || !account.handle) {
          return; // Skip invalid accounts
        }

        // Check if this platform already exists
        const existingAccountIndex = processedSocialMediaAccounts.findIndex(
          (existing) =>
            existing.platform.toLowerCase() === account.platform.toLowerCase()
        );

        if (existingAccountIndex !== -1) {
          // Update existing account
          processedSocialMediaAccounts[existingAccountIndex] = {
            ...processedSocialMediaAccounts[existingAccountIndex],
            ...account,
            _id:
              processedSocialMediaAccounts[existingAccountIndex]._id ||
              new mongoose.Types.ObjectId(),
          };
        } else {
          // Add new account
          processedSocialMediaAccounts.push({
            _id: new mongoose.Types.ObjectId(),
            ...account,
          });
        }
      });
    }

    // Update social media accounts
    updateData.socialMediaAccounts = processedSocialMediaAccounts;

    // Handle Documents
    const existingDocs = currentInfluencerDetails.documents || [];
    const incomingDocs = documents
      ? (typeof documents === "string" ? JSON.parse(documents) : documents).map(
          (doc) => ({
            _id: doc._id || new mongoose.Types.ObjectId(),
            url: doc.url,
            publicId: doc.publicId,
            type: doc.documentType || "Other",
          })
        )
      : [];

    // Combine documents without duplicates
    const combinedDocs = [
      ...existingDocs,
      ...uploadedDocuments,
      ...incomingDocs,
    ].filter(
      (doc, index, self) =>
        index === self.findIndex((t) => t.publicId === doc.publicId)
    );

    // Update documents
    updateData.documents = combinedDocs;

    // Save updated influencer data
    existingUser.influencerDetails = updateData;
    await existingUser.save();

    sendResponse(
      res,
      200,
      "Influencer details updated successfully",
      existingUser
    );
  } catch (error) {
    console.error("Update Influencer Error:", error);
    sendResponse(res, 500, "Error updating influencer details", error.message);
  }
};

exports.deleteInfluencerDoc = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { docId } = req.params;

    if (!docId) {
      return sendResponse(res, 400, "Document ID is required.");
    }

    const existingUser = await CustomerModel.findById(userId);

    if (!existingUser) {
      return sendResponse(res, 404, "User not found.");
    }

    const documents = existingUser.influencerDetails?.documents || [];
    const docIndex = documents.findIndex((doc) => doc._id.toString() === docId);

    if (docIndex === -1) {
      return sendResponse(res, 404, "Document not found.");
    }

    const documentToDelete = documents[docIndex];

    // Delete from S3
    await deleteFromS3(documentToDelete.publicId);

    // Remove document from the array
    const updatedDocuments = documents.filter(
      (doc) => doc._id.toString() !== docId
    );

    // Update the user document in the database
    const updatedUser = await CustomerModel.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          "influencerDetails.documents": updatedDocuments,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return sendResponse(res, 500, "Error updating user document.");
    }

    sendResponse(res, 200, "Document deleted successfully", {
      deletedDocumentId: docId,
    });
  } catch (error) {
    console.error("Delete Influencer Document Error:", error);
    sendResponse(res, 500, "Error deleting influencer document", error.message);
  }
};

exports.applyForBadge = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Find and update the user's badge status, resetting 'rejected' to false when applying
    const updatedUser = await CustomerModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          "isInfluencer.badgeStatus.applied": true,
          "isInfluencer.badgeStatus.rejected": false, // Reset rejected status to false
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Badge application submitted successfully",
      badgeStatus: updatedUser.isInfluencer.badgeStatus,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error", error });
  }
};

exports.sendPromotionRequest = async (req, res) => {
  try {
    const influencerId = req.user?.id;
    const { productId } = req.body;

    // Step 1: Check if the product exists
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    // Step 2: Find the influencer
    const influencer = await CustomerModel.findById(influencerId);
    if (!influencer) {
      return res.status(404).json({ message: "Influencer not found." });
    }
    const existingRequest = product.productRequests.some(
      (request) =>
        request.influencerId.toString() === influencerId &&
        request.status === "pending"
    );

    if (existingRequest) {
      return res
        .status(400)
        .json({ message: "Request already sent for this product." });
    }

    product.productRequests.push({
      influencerId: influencerId,
      status: "pending",
      requestedDate: Date.now(),
    });

    await product.save();

    // Step 5: Send notification to the product owner
    const productOwnerId = product.ownerId;
    const notificationMessage = `You have received a new promotion request from ${influencer.name} for your product.`;
    await NotificationService.createNotification({
      userId: productOwnerId,
      message: notificationMessage,
      type: "promotion_request",
    });

    res.status(200).json({
      message: "Promotion request sent to the product owner successfully.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error occurred." });
  }
};

exports.getPromotionStatus = async (req, res) => {
  try {
    const influencerId = req.user?.id;
    const { productId } = req.params;

    // Check if influencerId is available
    if (!influencerId) {
      return res.status(400).json({ message: "Influencer not authenticated." });
    }

    // Step 1: Find the product by ID
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    // Step 2: Check if the influencer has a request for this product
    const promotionRequest = product.productRequests.find(
      (request) => request.influencerId.toString() === influencerId
    );

    // If no promotion request found for this influencer and product
    if (!promotionRequest) {
      return res.status(404).json({
        message: "Promotion request not found for this product and influencer.",
      });
    }

    // Step 3: Return the promotion request status
    return res.status(200).json({
      message: "Promotion request status retrieved successfully.",
      status: promotionRequest.status,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error occurred." });
  }
};

exports.getMyCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const influencerId = req.user?.id;
    const skip = (page - 1) * limit;

    if (!influencerId) {
      return sendResponse(res, 400, false, "Influencer ID is required");
    }

    const influencer = await CustomerModel.findById(influencerId);
    if (!influencer || !influencer.isInfluencer.verified) {
      return sendResponse(res, 400, false, "User is not a verified influencer");
    }

    const companies = await CustomerModel.aggregate([
      {
        $match: {
          "companyInfluencers.influencerId": new mongoose.Types.ObjectId(
            influencerId
          ),
          "companyInfluencers.status": "accepted",
          "isCompany.verified": true,
        },
      },
      {
        $match: {
          $or: [
            {
              "companyDetails.companyInfo.companyName": {
                $regex: search,
                $options: "i",
              },
            },
            { email: { $regex: search, $options: "i" } },
            { name: { $regex: search, $options: "i" } },
          ],
        },
      },
      {
        $lookup: {
          from: "products",
          let: { companyId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$ownerId", "$$companyId"] },
                    {
                      $gt: [
                        {
                          $size: {
                            $ifNull: [
                              {
                                $filter: {
                                  input: { $ifNull: ["$productAssign", []] },
                                  as: "assign",
                                  cond: {
                                    $and: [
                                      {
                                        $eq: [
                                          "$$assign.influencerId",
                                          new mongoose.Types.ObjectId(
                                            influencerId
                                          ),
                                        ],
                                      },
                                      { $eq: ["$$assign.status", "accepted"] },
                                    ],
                                  },
                                },
                              },
                              [],
                            ],
                          },
                        },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "assignedProducts",
        },
      },
      {
        $project: {
          _id: 1,
          companyName: "$companyDetails.companyInfo.companyName",
          ownerName: "$companyDetails.companyInfo.ownerName",
          businessType: "$companyDetails.companyInfo.businessType",
          companyAbout: "$companyDetails.companyInfo.companyAbout",
          totalEmployees: "$companyDetails.companyInfo.totalEmployees",
          companyLogo: "$companyDetails.companyLogo",
          contactInfo: "$companyDetails.contactInfo",
          assignedProducts: {
            $map: {
              input: { $ifNull: ["$assignedProducts", []] },
              as: "product",
              in: {
                _id: "$$product._id",
                name: "$$product.basicDetails.name",
                description: "$$product.basicDetails.description",
                price: "$$product.basicDetails.price",
                slug: "$$product.basicDetails.slug", // Added slug field here
                images: {
                  $map: {
                    input: { $ifNull: ["$$product.images", []] },
                    as: "image",
                    in: {
                      url: "$$image.url",
                      publicId: "$$image.publicId",
                    },
                  },
                },
                status: "$$product.status",
                colors: {
                  $map: {
                    input: { $ifNull: ["$$product.colors", []] },
                    as: "color",
                    in: {
                      name: "$$color.name",
                      price: "$$color.price",
                      images: {
                        $map: {
                          input: { $ifNull: ["$$color.images", []] },
                          as: "colorImage",
                          in: {
                            url: "$$colorImage.url",
                            publicId: "$$colorImage.publicId",
                          },
                        },
                      },
                    },
                  },
                },
                assignmentDetails: {
                  $ifNull: [
                    {
                      $filter: {
                        input: { $ifNull: ["$$product.productAssign", []] },
                        as: "assign",
                        cond: {
                          $eq: [
                            "$$assign.influencerId",
                            new mongoose.Types.ObjectId(influencerId),
                          ],
                        },
                      },
                    },
                    [],
                  ],
                },
              },
            },
          },
          totalAssignedProducts: {
            $size: { $ifNull: ["$assignedProducts", []] },
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ]);

    const totalCount = await CustomerModel.countDocuments({
      "companyInfluencers.influencerId": new mongoose.Types.ObjectId(
        influencerId
      ),
      "companyInfluencers.status": "accepted",
      "isCompany.verified": true,
    });

    const data = {
      companies: companies || [],
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: parseInt(page),
        perPage: parseInt(limit),
      },
    };

    return sendResponse(
      res,
      200,
      true,
      "Companies and assigned products fetched successfully",
      data
    );
  } catch (error) {
    console.error("Error fetching influencer's companies:", error);
    return sendResponse(res, 500, false, "Internal Server Error");
  }
};

// exports.acceptRejectInvitation = async (req, res) => {
//   try {
//     const influencerId = req.user?.id; // Logged-in influencer's ID
//     const { companyId } = req.params;
//     const { status } = req.body; // 'accepted' or 'rejected'

//     // Log the incoming data for debugging
//     console.log("Received request to accept/reject invitation:", {
//       influencerId,
//       companyId,
//       status,
//     });

//     // Find the company that sent the invitation
//     const company = await CustomerModel.findById(companyId);
//     if (!company) {
//       console.log(`Company with ID ${companyId} not found.`);
//       return res.status(404).json({
//         success: false,
//         message: "Company not found",
//       });
//     }

//     console.log(`Found company: ${company.name}`);

//     // Find the invitation in the company's invitedInfluencers array
//     const invitationIndex = company.invitedInfluencers.findIndex(
//       (inv) => inv.influencerId.toString() === influencerId.toString()
//     );

//     if (invitationIndex === -1) {
//       console.log(
//         `Invitation not found for influencer ${influencerId} in company ${companyId}`
//       );
//       return res.status(404).json({
//         success: false,
//         message: "Invitation not found",
//       });
//     }

//     // Log the invitation before removing it
//     const invitation = company.invitedInfluencers[invitationIndex];
//     console.log(`Invitation found:`, invitation);

//     // Remove the invitation from invitedInfluencers array
//     company.invitedInfluencers.splice(invitationIndex, 1);
//     console.log(`Removed invitation for influencer ${influencerId}`);

//     if (status === "accepted") {
//       // Add to companyInfluencers if accepted
//       company.companyInfluencers.push({
//         influencerId: influencerId,
//         status: "accepted",
//         assignedDate: new Date(),
//       });
//       console.log(
//         `Added influencer ${influencerId} to companyInfluencers with status 'accepted'`
//       );
//     } else {
//       console.log(`Invitation rejected for influencer ${influencerId}`);
//     }

//     // Save the changes
//     await company.save();
//     console.log(`Company data saved successfully`);

//     return res.status(200).json({
//       success: true,
//       message: `Invitation ${status} successfully`,
//     });
//   } catch (error) {
//     console.error("Error handling invitation:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

exports.acceptRejectInvitation = async (req, res) => {
  try {
    const influencerId = req.user?.id;
    const { companyId } = req.params;
    const { status } = req.body;

    // Find the company that sent the invitation
    const company = await CustomerModel.findById(companyId);
    if (!company) {
      return sendResponse(res, 404, false, "Company not found");
    }

    // Find the invitation in the company's invitedInfluencers array
    const invitationIndex = company.invitedInfluencers.findIndex(
      (inv) => inv.influencerId.toString() === influencerId.toString()
    );

    if (invitationIndex === -1) {
      return sendResponse(res, 404, false, "Invitation not found");
    }

    // Get the invitation object
    const invitation = company.invitedInfluencers[invitationIndex];
    console.log("Found invitation:", invitation);

    // Process based on the status (accepted or rejected)
    if (status === "rejected") {
      // If status is 'rejected', directly remove the invitation and clean up data
      company.invitedInfluencers.splice(invitationIndex, 1);
    } else if (status === "accepted") {
      // If status is 'accepted', add influencer to companyInfluencers array
      company.companyInfluencers.push({
        influencerId: influencerId,
        status: "accepted",
        assignedDate: new Date(),
      });
      // Remove the invitation after acceptance
      company.invitedInfluencers.splice(invitationIndex, 1);
    }

    // Save the changes
    await company.save();
    return sendResponse(res, 200, true, `Invitation ${status} successfully`);
  } catch (error) {
    console.error("Error handling invitation:", error);
    return sendResponse(
      res,
      500,
      false,
      "Internal server error",
      error.message
    );
  }
};

exports.getAllInvitations = async (req, res) => {
  try {
    const influencerId = req.user?.id;
    if (!influencerId) {
      return res.status(400).json({ message: "Influencer ID is required" });
    }
    const { page = 1, limit = 10, search = "" } = req.query;
    // Calculate pagination parameters
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Build the search query
    const searchQuery = {
      "invitedInfluencers.influencerId": influencerId,
      $or: [
        {
          "companyDetails.companyInfo.companyName": {
            $regex: search,
            $options: "i",
          },
        },
        { email: { $regex: search, $options: "i" } },
      ],
    };

    // Find companies with invitations
    const companiesWithInvitations = await CustomerModel.find(searchQuery)
      .select({
        name: 1,
        email: 1,
        "companyDetails.companyInfo.companyName": 1,
        "companyDetails.companyInfo.companyAbout": 1,
        "companyDetails.companyLogo": 1,
        invitedInfluencers: {
          $elemMatch: {
            influencerId: influencerId,
          },
        },
      })
      .skip(skip)
      .limit(limitNumber);

    // Count total matching documents for pagination
    const totalItems = await CustomerModel.countDocuments(searchQuery);

    // If no invitations found
    if (!companiesWithInvitations || companiesWithInvitations.length === 0) {
      return res
        .status(404)
        .json({ message: "No invitations found for this influencer" });
    }

    // Format the results to be more user-friendly
    const formattedInvitations = companiesWithInvitations.map((company) => ({
      companyId: company._id,
      invitationId: company.invitedInfluencers[0]?.influencerId,
      companyName:
        company.companyDetails?.companyInfo?.companyName || company.name,
      companyEmail: company.email,
      companyLogo: company.companyDetails?.companyLogo?.url,
      invitationStatus: company.invitedInfluencers[0]?.status,
      invitationDate: company.invitedInfluencers[0]?.invitationDate,
    }));

    return res.status(200).json({
      invitations: formattedInvitations,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalItems / limitNumber),
        totalItems,
      },
    });
  } catch (error) {
    console.error("Error finding influencer invitations:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
