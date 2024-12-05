// const mongoose = require("mongoose");
// const Schema = mongoose.Schema;

// const visitedLogSchema = new Schema(
//     {
//         productId: { type: Schema.Types.ObjectId, ref: 'Product' },
//         users: [{
//             coordinates: {
//                 latitude: { type: String },
//                 longitude: { type: String }
//             },
//             userId: { type: String },
//             time: { type: Date, default: Date.now }
//         }]

//     },
//     {
//         timestamps: true,
//     }
// );

// module.exports = mongoose.model("visitedlogs", visitedLogSchema);

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const visitedLogSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    users: [
      {
        coordinates: {
          latitude: { type: String },
          longitude: { type: String },
          locationDetails: {
            formatted_address: { type: String },
            city: { type: String },
            state: { type: String },
            country: { type: String },
            postcode: { type: String },
          },
        },
        userId: { type: String },
        time: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
visitedLogSchema.index({ productId: 1 });
visitedLogSchema.index({ "users.time": 1 });
visitedLogSchema.index({ "users.userId": 1 });

module.exports = mongoose.model("visitedlogs", visitedLogSchema);
