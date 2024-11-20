const CustomerModel = require("../../models/Customer");

exports.getVerifiedCompanyUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalVerifiedCompanies = await CustomerModel.countDocuments({
            'isCompany.verified': true
        });

        const verifiedCompanies = await CustomerModel.find({
            'isCompany.verified': true
        })
            .select('-password -refreshToken -otp -otpExpiry')
            .limit(limit)
            .skip(skip);

        res.status(200).json({
            success: true,
            count: verifiedCompanies.length,
            total: totalVerifiedCompanies,
            totalPages: Math.ceil(totalVerifiedCompanies / limit),
            currentPage: page,
            data: verifiedCompanies,
            hasNextPage: (page * limit) < totalVerifiedCompanies,
            hasPrevPage: page > 1
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching verified companies",
            error: error.message
        });
    }
};

exports.getRejectedCompanyUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalRejectedCompanies = await CustomerModel.countDocuments({
            'isCompany.rejected': true
        });

        const rejectedCompanies = await CustomerModel.find({
            'isCompany.rejected': true
        })
            .select('-password -refreshToken -otp -otpExpiry')
            .limit(limit)
            .skip(skip);

        res.status(200).json({
            success: true,
            count: rejectedCompanies.length,
            total: totalRejectedCompanies,
            totalPages: Math.ceil(totalRejectedCompanies / limit),
            currentPage: page,
            data: rejectedCompanies,
            hasNextPage: (page * limit) < totalRejectedCompanies,
            hasPrevPage: page > 1
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching rejected companies",
            error: error.message
        });
    }
};

exports.getPendingCompanyUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalPendingCompanies = await CustomerModel.countDocuments({
            'isCompany.applied': true,
            'isCompany.verified': false
        });

        const pendingCompanies = await CustomerModel.find({
            'isCompany.applied': true,
            'isCompany.verified': false
        })
            .select('-password -refreshToken -otp -otpExpiry')
            .limit(limit)
            .skip(skip);

        res.status(200).json({
            success: true,
            count: pendingCompanies.length,
            total: totalPendingCompanies,
            totalPages: Math.ceil(totalPendingCompanies / limit),
            currentPage: page,
            data: pendingCompanies,
            hasNextPage: (page * limit) < totalPendingCompanies,
            hasPrevPage: page > 1
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching pending companies",
            error: error.message
        });
    }
};