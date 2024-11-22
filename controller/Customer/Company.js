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
    const userId = "673edb20d02d24bac67f993e";

    // 'formData' and 'contactData' should already be parsed as objects
    const documents = req.files?.documents || [];
    const companyLogo = req.files?.companyLogo?.[0];

    const saveFiles = [];
    try {
      // Upload documents to S3
      for (const doc of documents) {
        const uploadedDoc = await uploadToS3(
          doc.buffer,
          doc.originalname,
          doc.mimetype,
          "company/documents"
        );
        saveFiles.push({
          url: uploadedDoc.url,
          publicId: uploadedDoc.filename,
        });
      }

      // Upload company logo to S3
      let savedCompanyLogo = null;
      if (companyLogo) {
        const uploadedLogo = await uploadToS3(
          companyLogo.buffer,
          companyLogo.originalname,
          companyLogo.mimetype,
          "company/logos"
        );
        savedCompanyLogo = {
          url: uploadedLogo.url,
          publicId: uploadedLogo.filename,
        };
      }

      // Prepare data for saving to the database
      const companyData = {
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
        companyLogo: savedCompanyLogo,
        documents: saveFiles,
      };

      // Update the customer record in the database
      const customer = await Customer.findByIdAndUpdate(
        userId,
        { "isCompany.applied": true, companyDetails: companyData },
        { new: true }
      );

      res.status(200).json({
        message: "Company registered successfully",
        companyDetails: customer.companyDetails,
      });
    } catch (error) {
      console.error("Error uploading files:", error);
      res.status(500).json({ message: "Failed to register company", error });
    }
  },
};

module.exports = companyController;
