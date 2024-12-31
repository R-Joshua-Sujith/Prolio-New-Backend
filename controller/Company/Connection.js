const mongoose = require("mongoose");
const OwnerConnections = require("../../models/Connection");
const sendResponse = require("../../utils/responseHandler");

exports.createConnection = async (req, res) => {
  try {
    const { forumOwner, participant, forumId } = req.body;
    console.log("Request Body:", req.body);

    // Basic validation
    if (!forumOwner || !participant) {
      return res.status(400).json({
        success: false,
        message: "ForumOwner and participant are required fields",
      });
    }

    // Find owner's connections or create new document
    let ownerConnections = await OwnerConnections.findOne({ forumOwner });

    // If owner document exists, check for duplicate connection
    if (ownerConnections) {
      const existingConnection = ownerConnections.connections.find(
        (conn) => conn.participant.toString() === participant
      );

      if (existingConnection) {
        return res.status(200).json({
          success: true,
          message: "Connection already exists",
        });
      }

      // Add new connection to existing document
      const newConnection = {
        participant,
        ...(forum && { forum }),
      };

      ownerConnections.connections.push(newConnection);
    } else {
      // Create new document for owner
      ownerConnections = new OwnerConnections({
        forumOwner,
        connections: [
          {
            participant,
            ...(forum && { forum }),
          },
        ],
      });
    }

    // Save the document
    await ownerConnections.save();

    // Get the newly added connection with populated fields
    const updatedOwner = await OwnerConnections.findOne({ forumOwner })
      .populate({
        path: "connections.participant",
        model: "Customer",
        select: "name email profile.url", // Added profile.url for avatar
      })
      .populate({
        path: "connections.forum",
        model: "Forum",
        select: "forumName forumImage", // Updated to match your Forum model fields
      });

    const newConnection =
      updatedOwner.connections[updatedOwner.connections.length - 1];

    // Format the response with fields from your Customer model
    const responseData = {
      connectionId: newConnection._id,
      participant: {
        id: newConnection.participant._id,
        name: newConnection.participant.name,
        email: newConnection.participant.email,
        profileImage: newConnection.participant.profile?.url || null,
      },
      createdAt: newConnection.createdAt,
    };

    // Add forum data if it exists, using your Forum model fields
    if (newConnection.forum) {
      responseData.forum = {
        id: newConnection.forum._id,
        name: newConnection.forum.forumName,
        image: newConnection.forum.forumImage || null,
      };
    }

    return res.status(201).json({
      success: true,
      message: "Connection created successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Connection creation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create connection",
    });
  }
};

// Get all connections for a forum
exports.getForumConnections = async (req, res) => {
  try {
    const { forumId } = req.params;
    const connections = await ConnectionModel.find({ forum: forumId })
      .populate("forumOwner", "name email")
      .populate("participant", "name email");
    return sendResponse(
      res,
      200,
      "Connections retrieved successfully",
      connections
    );
  } catch (error) {
    console.error("Error fetching connections:", error);
    return sendResponse(res, 500, "Error fetching connections");
  }
};

// Get connections for a participant
exports.getParticipantConnections = async (req, res) => {
  try {
    const { participantId } = req.params;
    const connections = await ConnectionModel.find({
      participant: participantId,
    })
      .populate("forumOwner", "name email")
      .populate("forum", "name");
    return sendResponse(
      res,
      200,
      "Participant connections retrieved successfully",
      connections
    );
  } catch (error) {
    console.error("Error fetching participant connections:", error);
    return sendResponse(res, 500, "Error fetching participant connections");
  }
};

// Update connection status+
exports.updateConnectionStatus = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { status } = req.body;

    const updatedConnection = await ConnectionModel.findByIdAndUpdate(
      connectionId,
      { status },
      { new: true }
    );

    if (!updatedConnection) {
      return sendResponse(res, 404, "Connection not found");
    }

    return sendResponse(
      res,
      200,
      "Connection status updated successfully",
      updatedConnection
    );
  } catch (error) {
    console.error("Error updating connection status:", error);
    return sendResponse(res, 500, "Error updating connection status");
  }
};

// Delete a connection
exports.deleteConnection = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const ownerId = req.user.id; // Assuming you have the owner's ID from auth middleware

    // Find the owner's connections document
    const ownerConnections = await OwnerConnections.findOne({
      forumOwner: ownerId,
    });

    if (!ownerConnections) {
      return res.status(404).json({
        success: false,
        message: "No connections found for this owner",
      });
    }

    // Find and remove the specific connection from the connections array
    const connectionIndex = ownerConnections.connections.findIndex(
      (conn) => conn._id.toString() === connectionId
    );

    if (connectionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Connection not found",
      });
    }

    // Remove the connection from the array
    ownerConnections.connections.splice(connectionIndex, 1);

    // Save the updated document
    await ownerConnections.save();

    return res.status(200).json({
      success: true,
      message: "Connection deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting connection:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete connection",
    });
  }
};

// Get owner's connections
exports.getOwnerConnections = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Add query parameters for filtering and sorting
    const { sort = "desc", limit = 10, page = 1 } = req.query;

    const ownerConnections = await OwnerConnections.findOne({
      forumOwner: ownerId,
    })
      .populate({
        path: "connections.participant",
        model: "Customer",
        select:
          "name email profile.url isCompany companyDetails.companyInfo.companyName", // Added company info
      })
      .populate({
        path: "connections.forum",
        model: "Forum",
        select: "forumName forumImage forumDescription", // Added forum description
      });

    if (!ownerConnections || !ownerConnections.connections.length) {
      return res.status(200).json({
        success: true,
        message: "No connections found",
        data: {
          connections: [],
          totalConnections: 0,
          currentPage: parseInt(page),
          totalPages: 0,
        },
      });
    }

    // Sort connections
    let sortedConnections = [...ownerConnections.connections];
    sortedConnections.sort((a, b) => {
      return sort === "desc"
        ? new Date(b.createdAt) - new Date(a.createdAt)
        : new Date(a.createdAt) - new Date(b.createdAt);
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedConnections = sortedConnections.slice(startIndex, endIndex);

    // Format the connections array
    const formattedConnections = paginatedConnections.map((conn) => ({
      connectionId: conn._id,
      participant: {
        id: conn.participant._id,
        name: conn.participant.name,
        email: conn.participant.email,
        profileImage: conn.participant.profile?.url || null,
        isCompany: conn.participant.isCompany?.verified || false,
        companyName: conn.participant.isCompany?.verified
          ? conn.participant.companyDetails?.companyInfo?.companyName
          : null,
      },
      ...(conn.forum && {
        forum: {
          id: conn.forum._id,
          name: conn.forum.forumName,
          image: conn.forum.forumImage || null,
          description: conn.forum.forumDescription || null,
        },
      }),
      createdAt: conn.createdAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Connections retrieved successfully",
      data: {
        connections: formattedConnections,
        totalConnections: ownerConnections.connections.length,
        currentPage: parseInt(page),
        totalPages: Math.ceil(ownerConnections.connections.length / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching owner connections:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch connections",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.checkConnectionStatus = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { userId } = req.params;

    // Basic validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Participant ID is required",
      });
    }

    // Find owner's connections
    const ownerConnections = await OwnerConnections.findOne({
      forumOwner: ownerId,
    }).select("connections");

    // Check connection status
    const isConnected =
      ownerConnections?.connections.some(
        (conn) => conn.participant.toString() === userId
      ) || false;

    return res.status(200).json({
      success: true,
      data: {
        isConnected,
        userId,
        ownerId,
      },
    });
  } catch (error) {
    console.error("Error checking connection status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check connection status",
    });
  }
};
