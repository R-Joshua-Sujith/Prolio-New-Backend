const express = require("express");
const Customer = require("../../models/Customer");
const { uploadToS3 } = require("../../utils/s3FileUploader");
const { sendResponse } = require("../../utils/responseHandler");
const ProductModel = require("../../models/Product");
const Admin = require("../../models/Admin");
const NotificationService = require("../../utils/notificationService");
const companyController = {
  /**
   * Register company API
   * company registration and uploading files to S3.
   * @param {Object} req.body - (company info) and `contactData
   * @param {Object} req.files - Uploaded files (documents, companyLogo)
   */

  registerCompany: async (req, res) => {
    const { formData, contactData } = req.body;
    const userId = req.user?.id;
    const documents = req.files?.documents || [];
    const companyLogo = req.files?.companyLogo?.[0];

    const saveFiles = [];
    try {
      // Check if the customer exists
      const existingCustomer = await Customer.findById(userId);

      if (!existingCustomer) {
        return sendResponse(res, 404, false, "Customer not found");
      }
      // Check if the customer has already applied for company registration
      if (existingCustomer.isCompany.applied) {
        if (existingCustomer.isCompany.rejected) {
          if (!existingCustomer.isCompany.reApplied) {
            console.log("Re-applying for company registration");
            await Customer.findByIdAndUpdate(
              userId,
              {
                "isCompany.reApplied": true,
                "isCompany.rejected": false,
                "isCompany.applied": false,
              },
              { new: true }
            );
          } else {
            console.log("User has already re-applied for company registration");
            return sendResponse(
              res,
              400,
              false,
              "You have already re-applied for company registration."
            );
          }
        } else {
          console.log("User has already applied for company registration");
          return sendResponse(
            res,
            400,
            false,
            "You have already applied for company registration"
          );
        }
      }

      // Parse formData and contactData
      const parsedFormData = JSON.parse(formData);
      const parsedContactData = JSON.parse(contactData);

      // Handle document uploads
      if (documents.length > 0) {
        console.log(`Uploading ${documents.length} document(s)`);
        for (const doc of documents) {
          console.log("Uploading document:", doc.originalname);
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
          console.log("Uploaded document URL:", uploadedDoc.url);
        }
      }

      // Handle company logo upload
      let savedCompanyLogo = null;
      if (companyLogo) {
        console.log("Uploading company logo:", companyLogo.originalname);
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
        console.log("Uploaded company logo URL:", uploadedLogo.url);
      }

      // Prepare the company data
      const companyData = {
        companyInfo: {
          companyName: parsedFormData.companyName,
          ownerName: parsedFormData.ownerName,
          yearEstablishment: parsedFormData.yearEstablishment,
          gstNo: parsedFormData.gstNo,
          businessType: parsedFormData.businessType,
          totalEmployees: parsedFormData.totalEmployees,
          companyAbout: parsedFormData.companyAbout,
        },
        contactInfo: {
          address: parsedContactData.address,
          city: parsedContactData.city,
          state: parsedContactData.state,
          pincode: parsedContactData.pincode,
          email: parsedContactData.email,
          phone: parsedContactData.phone,
        },
        companyLogo: savedCompanyLogo,
        documents: saveFiles,
      };
      console.log("Final Company Data:", companyData);

      // Update the customer with company details and mark as applied
      const updatedCustomer = await Customer.findByIdAndUpdate(
        userId,
        {
          "isCompany.applied": true,
          companyDetails: companyData,
        },
        { new: true }
      );
      console.log("Updated Customer:", updatedCustomer);

      // Notify admins
      try {
        const admins = await Admin.find({});
        if (admins.length > 0) {
          const notificationMessage = `A new company has been registered by ${parsedFormData.ownerName}.`;
          const notificationPromises = admins.map((admin) =>
            NotificationService.createNotification({
              userId: admin._id,
              message: notificationMessage,
              type: "company_registration",
            })
          );
          await Promise.all(notificationPromises);
          // Send real-time notifications if Socket.io is available
          if (req.app.get("io")) {
            admins.forEach((admin) => {
              req.app.get("io").emit("newNotification", {
                userId: admin._id,
                message: notificationMessage,
              });
            });
          }
        }
      } catch (notificationError) {
        console.error("Error sending notifications:", notificationError);
        // Continue with the registration process even if notifications fail
      }
      console.log("Company registration successful");
      return sendResponse(res, 200, true, "Company registered successfully", {
        companyDetails: updatedCustomer.companyDetails,
      });
    } catch (error) {
      console.error("Error during company registration:", error);
      return sendResponse(
        res,
        500,
        false,
        "Failed to register company",
        error.message
      );
    }
  },

  // registerCompany: async (req, res) => {
  //   const { formData, contactData } = req.body;
  //   const userId = req.user?.id;
  //   const documents = req.files?.documents || [];
  //   const companyLogo = req.files?.companyLogo?.[0];

  //   const saveFiles = [];
  //   try {
  //     // Check if the customer exists
  //     const existingCustomer = await Customer.findById(userId);
  //     if (!existingCustomer) {
  //       return sendResponse(res, 404, false, "Customer not found");
  //     }

  //     // Check if the customer has already applied for company registration
  //     if (existingCustomer.isCompany.applied) {
  //       return sendResponse(
  //         res,
  //         400,
  //         false,
  //         "You have already applied for company registration"
  //       );
  //     }

  //     // Parse formData and contactData
  //     const parsedFormData = JSON.parse(formData);
  //     const parsedContactData = JSON.parse(contactData);

  //     // Handle document uploads
  //     if (documents.length > 0) {
  //       for (const doc of documents) {
  //         const uploadedDoc = await uploadToS3(
  //           doc.buffer,
  //           doc.originalname,
  //           doc.mimetype,
  //           "company/documents"
  //         );
  //         saveFiles.push({
  //           url: uploadedDoc.url,
  //           publicId: uploadedDoc.filename,
  //         });
  //       }
  //     }

  //     // Handle company logo upload
  //     let savedCompanyLogo = null;
  //     if (companyLogo) {
  //       const uploadedLogo = await uploadToS3(
  //         companyLogo.buffer,
  //         companyLogo.originalname,
  //         companyLogo.mimetype,
  //         "company/logos"
  //       );
  //       savedCompanyLogo = {
  //         url: uploadedLogo.url,
  //         publicId: uploadedLogo.filename,
  //       };
  //     }

  //     // Prepare the company data
  //     const companyData = {
  //       companyInfo: {
  //         companyName: parsedFormData.companyName,
  //         ownerName: parsedFormData.ownerName,
  //         yearEstablishment: parsedFormData.yearEstablishment,
  //         gstNo: parsedFormData.gstNo,
  //         businessType: parsedFormData.businessType,
  //         totalEmployees: parsedFormData.totalEmployees,
  //         companyAbout: parsedFormData.companyAbout,
  //       },
  //       contactInfo: {
  //         address: parsedContactData.address,
  //         city: parsedContactData.city,
  //         state: parsedContactData.state,
  //         pincode: parsedContactData.pincode,
  //         email: parsedContactData.email,
  //         phone: parsedContactData.phone,
  //       },
  //       companyLogo: savedCompanyLogo,
  //       documents: saveFiles,
  //     };

  //     // Update the customer with company details
  //     const updatedCustomer = await Customer.findByIdAndUpdate(
  //       userId,
  //       { "isCompany.applied": true, companyDetails: companyData },
  //       { new: true }
  //     );

  //     return sendResponse(res, 200, true, "Company registered successfully", {
  //       companyDetails: updatedCustomer.companyDetails,
  //     });
  //   } catch (error) {
  //     console.error("Error during company registration:", error);
  //     return sendResponse(
  //       res,
  //       500,
  //       false,
  //       "Failed to register company",
  //       error.message
  //     );
  //   }
  // },

  getCompanyDetails: async (req, res) => {
    try {
      const { productId } = req.params;
      // Fetch product details including basicDetails
      const product = await ProductModel.findById(
        productId,
        "ownerId basicDetails images"
      );
      if (!product) {
        return sendResponse(res, 404, false, "Product not found");
      }

      // Fetch owner details with companyDetails
      const owner = await Customer.findById(product.ownerId, "companyDetails");
      if (!owner) {
        return sendResponse(res, 404, false, "Owner not found");
      }

      return sendResponse(
        res,
        200,
        true,
        "Company and product details retrieved successfully",
        {
          companyDetails: owner.companyDetails,
          productBasicDetails: product.basicDetails,
          productImages: product.images,
        }
      );
    } catch (error) {
      console.error("Error fetching company and product details:", error);
      return sendResponse(
        res,
        500,
        false,
        "Failed to fetch company and product details",
        error.message
      );
    }
  },

  updateFiles: async (req, res) => {
    try {
      const userId = req.user?.id;
      const customer = await Customer.findById(userId);

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Handle documents
      if (req.files?.documents) {
        const uploads = await Promise.all(
          req.files.documents.map((doc) =>
            uploadToS3(
              doc.buffer,
              doc.originalname,
              doc.mimetype,
              "company/documents"
            )
          )
        );

        customer.companyDetails.documents = uploads.map((upload) => ({
          url: upload.url,
          publicId: upload.filename,
          originalName: upload.originalname,
        }));
      }

      // Handle logo
      if (req.files?.companyLogo) {
        const logo = req.files.companyLogo[0];

        // Delete old logo if exists
        if (customer.companyDetails?.companyLogo?.publicId) {
          await deleteFromS3(customer.companyDetails.companyLogo.url);
        }

        const uploadedLogo = await uploadToS3(
          logo.buffer,
          logo.originalname,
          logo.mimetype,
          "company/logos"
        );

        customer.companyDetails.companyLogo = {
          url: uploadedLogo.url,
          publicId: uploadedLogo.filename,
          originalName: logo.originalname,
        };
      }

      await customer.save();
      res.status(200).json({
        message: "Files updated successfully",
        companyDetails: customer.companyDetails,
      });
    } catch (error) {
      console.error("Error updating files:", error);
      res.status(500).json({ message: "Failed to update files", error });
    }
  },
};

module.exports = companyController;
