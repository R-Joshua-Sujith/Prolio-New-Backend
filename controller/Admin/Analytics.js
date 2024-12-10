const Customer = require("../../models/Customer");
const Product = require("../../models/Product");
const Forum = require("../../models/Forum");
const ProductReport = require("../../models/ReportProduct");

const getDashboardStatsOptimized = async (req, res) => {
  try {
    const { timeframe = "month" } = req.query; // 'week', 'month', 'year'

    // Get date range based on timeframe
    const getDateRange = () => {
      const now = new Date();
      switch (timeframe) {
        case "week":
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          return weekAgo;
        case "year":
          const yearAgo = new Date(now);
          yearAgo.setFullYear(now.getFullYear() - 1);
          return yearAgo;
        default: // month
          const monthAgo = new Date(now);
          monthAgo.setMonth(now.getMonth() - 1);
          return monthAgo;
      }
    };

    const previousDate = getDateRange();

    // Get current stats
    const currentStats = await Promise.all([
      // Companies
      Customer.countDocuments({ "isCompany.verified": true }),

      // Products
      Product.countDocuments(),
      Product.countDocuments({ status: "Active" }),
      Product.countDocuments({ status: "Inactive" }),
      Product.countDocuments({ status: "Draft" }),

      // Forums
      Forum.countDocuments(),
      Forum.countDocuments({ isActive: true }),
      Forum.countDocuments({ isActive: false }),

      // Reports
      ProductReport.countDocuments(),
    ]);

    // Get previous stats based on timeframe
    const previousStats = await Promise.all([
      // Previous Companies
      Customer.countDocuments({
        "isCompany.verified": true,
        createdAt: { $lt: previousDate },
      }),

      // Previous Products
      Product.countDocuments({ createdAt: { $lt: previousDate } }),
      Product.countDocuments({
        status: "Active",
        createdAt: { $lt: previousDate },
      }),
      Product.countDocuments({
        status: "Inactive",
        createdAt: { $lt: previousDate },
      }),
      Product.countDocuments({
        status: "Draft",
        createdAt: { $lt: previousDate },
      }),

      // Previous Forums
      Forum.countDocuments({ createdAt: { $lt: previousDate } }),
      Forum.countDocuments({
        isActive: true,
        createdAt: { $lt: previousDate },
      }),
      Forum.countDocuments({
        isActive: false,
        createdAt: { $lt: previousDate },
      }),

      // Previous Reports
      ProductReport.countDocuments({ createdAt: { $lt: previousDate } }),
    ]);

    // Get growth data based on timeframe
    const getGrowthAggregation = (model, matchCriteria = {}) => {
      const groupByTimeframe =
        timeframe === "week"
          ? { $dayOfWeek: "$createdAt" }
          : timeframe === "year"
          ? { $month: "$createdAt" }
          : { $dayOfMonth: "$createdAt" };

      return model.aggregate([
        {
          $match: {
            ...matchCriteria,
            createdAt: { $gte: previousDate },
          },
        },
        {
          $group: {
            _id: groupByTimeframe,
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    };

    // Get growth data for all metrics
    const growthData = await Promise.all([
      // Companies growth
      getGrowthAggregation(Customer, { "isCompany.verified": true }),

      // Products growth
      getGrowthAggregation(Product),
      getGrowthAggregation(Product, { status: "Active" }),
      getGrowthAggregation(Product, { status: "Inactive" }),

      // Forums growth
      getGrowthAggregation(Forum),
      getGrowthAggregation(Forum, { isActive: true }),

      // Reports growth
      getGrowthAggregation(ProductReport),
    ]);

    // Calculate percentage change
    const calculateChange = (current, previous) => {
      if (previous === 0) return { percentageChange: 100, trend: "up" };
      const change = ((current - previous) / previous) * 100;
      return {
        percentageChange: parseFloat(change.toFixed(2)),
        trend: change >= 0 ? "up" : "down",
      };
    };

    // Format growth data
    const formatGrowthData = (growthArray) => {
      const defaultLength =
        timeframe === "week" ? 7 : timeframe === "year" ? 12 : 31;
      const formattedData = new Array(defaultLength).fill(0);

      growthArray.forEach((item) => {
        const index = timeframe === "week" ? item._id - 1 : item._id - 1;
        if (index >= 0 && index < defaultLength) {
          formattedData[index] = item.count;
        }
      });

      return formattedData;
    };

    const analyticsData = {
      timeframe,
      companies: {
        total: currentStats[0],
        ...calculateChange(currentStats[0], previousStats[0]),
        growth: formatGrowthData(growthData[0]),
      },
      products: {
        total: currentStats[1],
        ...calculateChange(currentStats[1], previousStats[1]),
        breakdown: {
          active: currentStats[2],
          inactive: currentStats[3],
          draft: currentStats[4],
        },
        growth: formatGrowthData(growthData[1]),
        activeGrowth: formatGrowthData(growthData[2]),
        inactiveGrowth: formatGrowthData(growthData[3]),
      },
      forums: {
        total: currentStats[5],
        ...calculateChange(currentStats[5], previousStats[5]),
        breakdown: {
          active: currentStats[6],
          inactive: currentStats[7],
        },
        growth: formatGrowthData(growthData[4]),
        activeGrowth: formatGrowthData(growthData[5]),
      },
      reports: {
        total: currentStats[8],
        ...calculateChange(currentStats[8], previousStats[8]),
        growth: formatGrowthData(growthData[6]),
      },
    };

    res.status(200).json({
      success: true,
      data: analyticsData,
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch analytics data",
    });
  }
};

// Basic version for simple stats
const getDashboardStats = async (req, res) => {
  try {
    const totalCompanies = await Customer.countDocuments({
      "isCompany.verified": true,
    });

    const totalProducts = await Product.countDocuments();
    const totalForums = await Forum.countDocuments();
    const totalProductReports = await ProductReport.countDocuments();

    const analyticsData = {
      totalCompanies,
      totalProducts,
      totalForums,
      totalProductReports,
    };

    res.status(200).json({
      success: true,
      data: analyticsData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getDashboardStatsOptimized,
};
