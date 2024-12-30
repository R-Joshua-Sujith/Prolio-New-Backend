const CompanyUser = require("../../models/CompanyUser");
const EnquiryModel = require("../../models/Enquiry");
const OpportunityModel = require("../../models/Opportunity");
const ProductModel = require("../../models/Product");
const ForumModel = require("../../models/Forum")
const bcrypt = require("bcrypt");


const getAllDetailsOfCompany = async (req, res) => {
    const ownerId = req.user.id;
    try {
        const products = await ProductModel.find({ ownerId: ownerId }).select("_id basicDetails.id basicDetails.name");
        const forums = await ForumModel.find({ ownerId: ownerId }).select("_id forumName")

        res.status(200).json({
            products,
            forums
        })

    } catch (error) {
        console.error("Error Message", error);
        return res.status(500).json({ error: error.message })
    }
}

// Create company user
const createCompanyUser = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { email, password, phone, department, access } = req.body;
        console.log(access);
        // Validate required fields
        if (!email || !password || !phone) {
            return res.status(400).json({
                error: "Email, password and phone are required"
            });
        }

        // Check if email already exists
        const existingUser = await CompanyUser.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                error: "Email already registered"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = await CompanyUser.create({
            ownerId,
            email,
            password: hashedPassword,
            phone,
            department,
            access
        });

        // Remove password from response
        const userResponse = newUser.toObject();
        delete userResponse.password;

        res.status(201).json({
            message: "User created successfully",
            user: userResponse
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get all company users
const getAllCompanyUsers = async (req, res) => {
    try {
        const ownerId = req.user.id;

        const users = await CompanyUser.find({ ownerId })
            .select('-password')  // Exclude password
            .populate('department', 'name'); // Populate department name

        res.status(200).json({ users });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get single company user
const getCompanyUser = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { userId } = req.params;

        const user = await CompanyUser.findOne({
            _id: userId,
            ownerId
        })
            .select('-password')
            .populate('department', 'name');

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({ user });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Update company user
const updateCompanyUser = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { userId } = req.params;
        const { email, phone, department, access } = req.body;

        // Check if user exists and belongs to owner
        const user = await CompanyUser.findOne({ _id: userId, ownerId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // If email is being changed, check if new email already exists
        if (email && email !== user.email) {
            const existingUser = await CompanyUser.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    error: "Email already registered"
                });
            }
        }

        // Update user
        const updatedUser = await CompanyUser.findByIdAndUpdate(
            userId,
            {
                email: email || user.email,
                phone: phone || user.phone,
                department: department || user.department,
                access: access || user.access
            },
            { new: true }
        ).select('-password');

        res.status(200).json({
            message: "User updated successfully",
            user: updatedUser
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Delete company user
const deleteCompanyUser = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { userId } = req.params;

        // Check if user exists and belongs to owner
        const user = await CompanyUser.findOne({ _id: userId, ownerId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await CompanyUser.findByIdAndDelete(userId);

        res.status(200).json({
            message: "User deleted successfully"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    createCompanyUser,
    getAllCompanyUsers,
    getCompanyUser,
    updateCompanyUser,
    deleteCompanyUser,
    getAllDetailsOfCompany
};