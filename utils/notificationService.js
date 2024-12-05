// notificationService.js
const Notification = require("../models/Notification");

class NotificationService {
  /**
   * Create a notification for a specific user
   * @param {Object} params - Notification parameters
   * @param {string} params.userId - ID of the user receiving the notification
   * @param {string} params.message - Notification message
   * @param {string} params.type - Notification type
   * @param {Object} [params.metadata] - Optional additional metadata
   * @param {Object} [params.io] - Socket.io instance for real-time notifications
   * @returns {Promise<Notification>} Created notification
   */
  static async createNotification({ userId, message, type, io = null }) {
    try {
      // Create notification
      const notification = new Notification({
        userId,
        message,
        type,
      });

      // Save notification to database
      await notification.save();

      // Emit real-time notification if socket.io is available
      if (io) {
        io.to(userId.toString()).emit("notification", notification);
      }

      return notification;
    } catch (error) {
      console.error(`Error creating notification: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Create multiple notifications in batch
   * @param {Array<Object>} notificationsData - Array of notification parameters
   * @param {Object} [options] - Additional options
   * @param {Object} [options.io] - Socket.io instance for real-time notifications
   * @returns {Promise<Array<Notification>>} Created notifications
   */
  static async createBatchNotifications(notificationsData, io = null) {
    try {
      // Create and save notifications
      const notifications = await Promise.all(
        notificationsData.map(async (notificationData) => {
          const notification = new Notification(notificationData);
          await notification.save();

          // Emit real-time notification if socket.io is available
          if (io) {
            io.to(notificationData.userId.toString()).emit(
              "notification",
              notification
            );
          }

          return notification;
        })
      );

      return notifications;
    } catch (error) {
      console.error(
        `Error creating batch notifications: ${error.message}`,
        error
      );
      throw error;
    }
  }
}

module.exports = NotificationService;
