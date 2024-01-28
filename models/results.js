const mongoose = require("mongoose");

const resultsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        require: true,
    },
    result: [
        {
            name:{
                type: String,
            },
            domain: [
                {
                    name:{
                        type:String,
                    },
                    score:{
                        type:Number,
                        default:0
                    },
                    condition:{
                        type:String,
                    }
                }
            ],
            score:{
                type: Number,
            },
            condition:{
                type: String,
            }
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Results = mongoose.model("Results", resultsSchema);

module.exports = Results