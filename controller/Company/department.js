const CustomerModel = require("../../models/Customer");
const CompanyUser = require("../../models/CompanyUser"); // Make sure to import

// Create new department
const createDepartment = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Department name is required" });
        }

        const customer = await CustomerModel.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }

        const newDepartment = {
            name,
            users: []
        };

        customer.departments.push(newDepartment);
        await customer.save();

        res.status(201).json({
            message: "Department created successfully",
            department: customer.departments[customer.departments.length - 1]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get all departments
const getAllDepartments = async (req, res) => {
    try {
        const customerId = req.user.id;

        const customer = await CustomerModel.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }

        // Populate users in each department
        const populatedDepartments = await Promise.all(
            customer.departments.map(async (dept) => {
                const users = await CompanyUser.find({
                    _id: { $in: dept.users }
                }).select('-password');
                return {
                    ...dept.toObject(),
                    users
                };
            })
        );

        res.status(200).json({ departments: populatedDepartments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get single department
const getDepartment = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { departmentId } = req.params;

        const customer = await CustomerModel.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }

        const department = customer.departments.id(departmentId);
        if (!department) {
            return res.status(404).json({ error: "Department not found" });
        }

        // Populate users
        const users = await CompanyUser.find({
            _id: { $in: department.users }
        }).select('-password');

        res.status(200).json({
            department: {
                ...department.toObject(),
                users
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Update department
const updateDepartment = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { departmentId } = req.params;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Department name is required" });
        }

        const customer = await CustomerModel.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }

        const department = customer.departments.id(departmentId);
        if (!department) {
            return res.status(404).json({ error: "Department not found" });
        }

        department.name = name;
        await customer.save();

        res.status(200).json({
            message: "Department updated successfully",
            department
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Delete department
const deleteDepartment = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { departmentId } = req.params;

        const customer = await CustomerModel.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }

        // Find the department index
        const departmentIndex = customer.departments.findIndex(
            dept => dept._id.toString() === departmentId
        );

        if (departmentIndex === -1) {
            return res.status(404).json({ error: "Department not found" });
        }

        // Get department users before removing
        const departmentUsers = customer.departments[departmentIndex].users;

        // Remove department using pull operator
        customer.departments.pull({ _id: departmentId });

        // Remove department references from CompanyUsers
        if (departmentUsers.length > 0) {
            await CompanyUser.updateMany(
                { _id: { $in: departmentUsers } },
                { $unset: { department: "" } }
            );
        }

        await customer.save();

        res.status(200).json({ message: "Department deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Add user to department
const addUserToDepartment = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { departmentId } = req.params;
        const { userId } = req.body;

        const customer = await CustomerModel.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }

        const department = customer.departments.id(departmentId);
        if (!department) {
            return res.status(404).json({ error: "Department not found" });
        }

        const user = await CompanyUser.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if user already in department
        if (department.users.includes(userId)) {
            return res.status(400).json({ error: "User already in department" });
        }

        // Add user to department
        department.users.push(userId);

        // Update user's department reference
        user.department = departmentId;

        await Promise.all([customer.save(), user.save()]);

        res.status(200).json({
            message: "User added to department successfully",
            department
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Remove user from department
const removeUserFromDepartment = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { departmentId } = req.params;
        const { userId } = req.body;

        const customer = await CustomerModel.findById(customerId);
        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }

        const department = customer.departments.id(departmentId);
        if (!department) {
            return res.status(404).json({ error: "Department not found" });
        }

        // Remove user from department
        department.users = department.users.filter(id => id.toString() !== userId);

        // Remove department reference from user
        await CompanyUser.findByIdAndUpdate(userId, {
            $unset: { department: "" }
        });

        await customer.save();

        res.status(200).json({
            message: "User removed from department successfully",
            department
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    createDepartment,
    getAllDepartments,
    getDepartment,
    updateDepartment,
    deleteDepartment,
    addUserToDepartment,
    removeUserFromDepartment
};