const CustomerModel = require("../../models/Customer");
const { sendResponse } = require("../../utils/responseHandler");
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");
const mongoose = require("mongoose"); // Import mongoose for ObjectId

// Controller function to register an influencer (with file upload handling)
exports.registerInfluencer = async (req, res) => {
  try {
    const userId = req.user?.id;
    const existingUser = await CustomerModel.findById(userId);

    if (!existingUser) {
      return sendResponse(res, 404, "User not found. Please register first.");
    }

    // Check if the user has already applied for influencer registration
    if (existingUser.isInfluencer.applied) {
      return sendResponse(
        res,
        400,
        "User has already applied for influencer registration."
      );
    }

    // Destructure influencer details from the request body
    const {
      address,
      country = "India",
      city,
      state,
      pincode,
      bio,
      socialMediaAccounts,
      documents,
    } = req.body;

    const uploadedDocuments = [];

    // Handle file uploads if provided
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const { buffer, originalname, mimetype } = file;
        // Upload the file to S3
        const uploadResponse = await uploadToS3(
          buffer,
          originalname,
          mimetype,
          "influencer-docs"
        );
        uploadedDocuments.push({
          filename: uploadResponse.filename,
          url: uploadResponse.url,
          publicId: uploadResponse.publicId,
        });
      }
    }

    // If documents are provided in the request body, use them; otherwise, use the uploaded ones
    const finalDocuments = documents
      ? documents.concat(uploadedDocuments)
      : uploadedDocuments;

    // Update influencer details for the existing user
    existingUser.isInfluencer.applied = true;
    existingUser.isInfluencer.verified = false;
    existingUser.influencerDetails = {
      address,
      country,
      city,
      state,
      pincode,
      bio,
      socialMediaAccounts, // Directly store the social media accounts array
      documents: finalDocuments,
    };

    // Save the updated user data
    await existingUser.save();

    // Send success response
    sendResponse(
      res,
      200,
      "Influencer application submitted successfully",
      existingUser
    );
  } catch (error) {
    console.error(error);
    sendResponse(
      res,
      500,
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

    // Update logic for documents
    const updateData = {
      ...(existingUser.influencerDetails || {}),
    };

    // Merge existing and new documents (no deletion from S3)
    const existingDocs = existingUser.influencerDetails?.documents || [];
    const incomingDocs = documents
      ? JSON.parse(documents).map((doc) => ({
          _id: doc._id || new mongoose.Types.ObjectId(),
          url: doc.url,
          publicId: doc.publicId,
          documentType: doc.documentType || "Other",
        }))
      : [];

    // Combine documents without deleting the old ones
    const combinedDocs = [
      ...existingDocs,
      ...uploadedDocuments,
      ...incomingDocs,
    ].filter(
      (doc, index, self) =>
        index === self.findIndex((t) => t.publicId === doc.publicId)
    );

    // Update other influencer details
    if (address) updateData.address = address;
    if (country) updateData.country = country;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (pincode) updateData.pincode = pincode;
    if (bio) updateData.bio = bio;

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
