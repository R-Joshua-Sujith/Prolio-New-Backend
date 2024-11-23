const express = require("express");
const Customer = require("../../models/Customer");
const { uploadToS3 } = require("../../utils/s3FileUploader");

const companyController = {
  /**
   * Register company API
   * company registration and uploading files to S3.
   * @param {Object} req -request object
   * @param {Object} req.body - (company info) and `contactData
   * @param {Object} req.files - Uploaded files (documents, companyLogo)
   * @param {Object} res -response object
   * @returns {void}
   */
  registerCompany: async (req, res) => {
    const { formData, contactData } = req.body;
    const userId = "673edb20d02d24bac67f993e"; // Assuming you have the user's ID from the auth middleware

    try {
      // Find the existing customer by user ID
      const existingCustomer = await Customer.findById(userId);

      if (!existingCustomer) {
        return res.status(404).json({
          message: "Customer not found",
        });
      }

      // Check if the customer has already applied as a company
      if (existingCustomer.isCompany.applied) {
        return res.status(400).json({
          message: "Company registration already applied",
        });
      }

      // Update the customer document with company details
      existingCustomer.companyDetails = {
        companyInfo: {
          companyName: formData.companyName,
          ownerName: formData.ownerName,
          yearEstablishment: formData.yearEstablishment,
          gstNo: formData.gstNo,
          businessType: formData.businessType,
          totalEmployees: formData.totalEmployees,
        },
        contactInfo: {
          address: contactData.address,
          city: contactData.city,
          state: contactData.state,
          pincode: contactData.pincode,
          email: contactData.email,
          phone: contactData.phone,
        },
        companyLogo: formData.companyLogo, // Optional: logo data if provided
        documents: formData.documents || [], // Optional: uploaded documents
      };

      // Update the isCompany field
      existingCustomer.isCompany = {
        applied: true,
        verified: false,
        rejected: false,
      };

      // Save the updated customer document
      const updatedCustomer = await existingCustomer.save();

      res.status(200).json({
        message: "Company registered successfully",
        companyDetails: updatedCustomer.companyDetails,
      });
    } catch (error) {
      console.error("Error registering company:", error);
      res.status(500).json({
        message: "Failed to register company",
        error: error.message,
      });
    }
  },


};

module.exports = companyController;
