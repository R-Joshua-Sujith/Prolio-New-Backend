const CustomerModel = require("../../models/Customer");
const { sendResponse } = require("../../utils/responseHandler");
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const mongoose = require("mongoose"); // Import mongoose for ObjectId

// Controller function to register an influencer (with file upload handling)
// exports.registerInfluencer = async (req, res) => {
//   try {
//     const userId = req.user?.id;
//     const existingUser = await CustomerModel.findById(userId);

//     if (!existingUser) {
//       return sendResponse(res, 404, "User not found. Please register first.");
//     }

//     // Check if the user has already applied for influencer registration
//     if (existingUser.isInfluencer.applied) {
//       return sendResponse(
//         res,
//         400,
//         "User has already applied for influencer registration."
//       );
//     }

//     // Destructure influencer details from the request body
//     const {
//       address,
//       country = "India",
//       city,
//       state,
//       pincode,
//       bio,
//       socialMediaAccounts,
//       documents,
//     } = req.body;

//     const uploadedDocuments = [];

//     // Handle file uploads if provided
//     if (req.files && req.files.length > 0) {
//       for (let file of req.files) {
//         const { buffer, originalname, mimetype } = file;
//         // Upload the file to S3
//         const uploadResponse = await uploadToS3(
//           buffer,
//           originalname,
//           mimetype,
//           "influencer-docs"
//         );
//         uploadedDocuments.push({
//           filename: uploadResponse.filename,
//           url: uploadResponse.url,
//           publicId: uploadResponse.publicId,
//         });
//       }
//     }

//     // If documents are provided in the request body, use them; otherwise, use the uploaded ones
//     const finalDocuments = documents
//       ? documents.concat(uploadedDocuments)
//       : uploadedDocuments;

//     // Update influencer details for the existing user
//     existingUser.isInfluencer.applied = true;
//     existingUser.isInfluencer.verified = false;
//     existingUser.influencerDetails = {
//       address,
//       country,
//       city,
//       state,
//       pincode,
//       bio,
//       socialMediaAccounts, // Directly store the social media accounts array
//       documents: finalDocuments,
//     };

//     // Save the updated user data
//     await existingUser.save();

//     // Send success response
//     sendResponse(
//       res,
//       200,
//       "Influencer application submitted successfully",
//       existingUser
//     );
//   } catch (error) {
//     console.error(error);
//     sendResponse(
//       res,
//       500,
//       "Error processing influencer registration",
//       error.message
//     );
//   }
// };

exports.registerInfluencer = async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log("Body:", req.body);
    const existingUser = await CustomerModel.findById(userId);

    if (!existingUser) {
      return sendResponse(res, 404, false, "User not found. Please register first.");
    }

    if (existingUser.isInfluencer.applied) {
      return sendResponse(res, 400, false, "User has already applied for influencer registration.");
    }

    // Parse the personal data from the request body
    const personalData = JSON.parse(req.body.personalData);
    
    const uploadedDocuments = [];

    // Handle file uploads
    if (req.files) {
      for (const [fieldName, fileArray] of Object.entries(req.files)) {
        // Handle each file in the field
        for (const file of fileArray) {
          try {
            const uploadResponse = await uploadToS3(
              file.buffer,
              file.originalname,
              file.mimetype,
              "influencer-docs"
            );

            uploadedDocuments.push({
              type: fieldName, // pan_document, aadhar_document, other_documents, profile_photo
              filename: uploadResponse.filename,
              url: uploadResponse.url,
              publicId: uploadResponse.filename // Using filename as publicId based on s3FileUploader implementation
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
        firstName: personalData.firstName,
        lastName: personalData.lastName,
        email: personalData.email,
        mobileNumber: personalData.mobileNumber,
        address: personalData.address,
        country: personalData.country,
        city: personalData.city,
        state: personalData.state,
        pincode: personalData.pincode,
        bio: personalData.bio,
        socialMediaAccounts: personalData.socialHandles,
        documents: uploadedDocuments
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
      // If save fails, cleanup uploaded documents
      if (uploadedDocuments.length > 0) {
        for (let doc of uploadedDocuments) {
          try {
            await deleteFromS3(doc.publicId);
          } catch (deleteError) {
            console.error("Cleanup error:", deleteError);
          }
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
          documentType: req.body.documentType || "Other",
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
            documentType: doc.documentType || "Other",
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
