const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const visitedLogSchema = new Schema(
    {
        productId: { type: Schema.Types.ObjectId, ref: 'Product' },
        users: [{
            coordinates: {
                latitude: { type: String },
                longitude: { type: String }
            },
            userId: { type: String },
            time: { type: Date, default: Date.now }
        }]

    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("visitedlogs", visitedLogSchema);
